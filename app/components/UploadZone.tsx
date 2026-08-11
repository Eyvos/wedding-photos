"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ACCEPT_ATTRIBUTE,
  MAX_FILE_SIZE,
  MAX_NAME_LENGTH,
  formatBytes,
  isAllowedFile,
  isVideoFile,
} from "@/lib/config";
import { mediaCount } from "@/lib/gallery";
import { runPool, uploadFile } from "@/lib/upload";

import { CameraIcon, CheckIcon, CloseIcon, VideoIcon } from "./icons";

type Status = "pending" | "uploading" | "done" | "error";

type Item = {
  id: string;
  file: File;
  /** Une vidéo s'annonce, s'aperçoit et se refuse autrement qu'une photo */
  video: boolean;
  /** objectURL pour la vignette, ou null si le format n'est pas affichable */
  preview: string | null;
  status: Status;
  progress: number;
  error?: string;
};

const NAME_STORAGE_KEY = "wedding-photos:guest-name";

/** Les HEIC d'iPhone ne s'affichent pas dans un <img> : pas de vignette. */
const PREVIEWABLE = /^image\/(jpeg|png|gif|webp|avif)$/;

/** Combien de ces fichiers sont des vidéos — pour les libellés */
function videosIn(items: Item[]): number {
  return items.filter((item) => item.video).length;
}

export default function UploadZone() {
  /** Prénom retenu au lancement de l'envoi, pour l'écran de remerciement */
  const [sentName, setSentName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const [nameError, setNameError] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Miroir des objectURL, pour les révoquer sans dépendre du rendu */
  const previewsRef = useRef<Set<string>>(new Set());
  /** Clés « nom:taille » déjà dans la liste, pour ignorer les doublons */
  const seenRef = useRef<Set<string>>(new Set());

  // Le prénom saisi une fois est réutilisé si l'invité revient plus tard.
  // Le champ reste non contrôlé : on écrit dans le DOM plutôt que dans l'état,
  // ce qui évite un rendu en cascade et tout écart d'hydratation.
  useEffect(() => {
    const saved = window.localStorage.getItem(NAME_STORAGE_KEY);
    if (saved && nameRef.current) nameRef.current.value = saved;
  }, []);

  useEffect(() => {
    const previews = previewsRef.current;
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
      abortRef.current?.abort();
    };
  }, []);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    // Tri et création des objectURL hors de setItems : un updater doit rester
    // pur, sans quoi React (qui le rejoue) doublerait les effets de bord.
    const refused: string[] = [];
    const additions: Item[] = [];

    for (const file of Array.from(fileList)) {
      // Deux sélections successives contiennent souvent les mêmes photos
      const key = `${file.name}:${file.size}`;
      if (seenRef.current.has(key)) continue;

      if (!isAllowedFile(file.name)) {
        refused.push(`${file.name} — ce n'est ni une photo ni une vidéo`);
        continue;
      }

      const video = isVideoFile(file.name);

      if (file.size > MAX_FILE_SIZE) {
        refused.push(
          video
            ? `${file.name} — trop lourde (150 Mo maximum, environ 2 min en 1080p)`
            : `${file.name} — trop lourde (150 Mo maximum)`,
        );
        continue;
      }

      seenRef.current.add(key);

      // Une vidéo se montre par sa première image ; le navigateur la peint
      // depuis le fichier local, sans rien télécharger.
      let preview: string | null = null;
      if (video || PREVIEWABLE.test(file.type)) {
        preview = URL.createObjectURL(file);
        previewsRef.current.add(preview);
      }

      additions.push({
        id: key,
        file,
        video,
        preview,
        status: "pending",
        progress: 0,
      });
    }

    if (additions.length > 0) setItems((current) => [...current, ...additions]);
    setRejected(refused);
  }, []);

  const removeItem = useCallback((removed: Item) => {
    setItems((current) => current.filter((item) => item.id !== removed.id));

    seenRef.current.delete(removed.id);
    if (removed.preview) {
      URL.revokeObjectURL(removed.preview);
      previewsRef.current.delete(removed.preview);
    }
  }, []);

  const patchItem = useCallback((id: string, patch: Partial<Item>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const pending = useMemo(
    () => items.filter((item) => item.status === "pending" || item.status === "error"),
    [items],
  );
  const sent = useMemo(
    () => items.filter((item) => item.status === "done"),
    [items],
  );
  const failed = useMemo(
    () => items.filter((item) => item.status === "error"),
    [items],
  );

  async function startUpload() {
    const name = nameRef.current?.value.trim() ?? "";

    if (name.length === 0) {
      setNameError(true);
      nameRef.current?.focus();
      nameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setNameError(false);
    setSentName(name);
    window.localStorage.setItem(NAME_STORAGE_KEY, name);

    const queue = pending;
    if (queue.length === 0) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsUploading(true);
    setRejected([]);

    // Snapshot des ids : `items` change pendant l'envoi, `queue` non
    const ids = queue.map((item) => item.id);
    setItems((current) =>
      current.map((item) =>
        ids.includes(item.id)
          ? { ...item, status: "uploading", progress: 0, error: undefined }
          : item,
      ),
    );

    await runPool(queue, async (item) => {
      try {
        await uploadFile(
          name,
          item.file,
          (ratio) => patchItem(item.id, { progress: ratio }),
          controller.signal,
        );
        patchItem(item.id, { status: "done", progress: 1 });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          patchItem(item.id, { status: "pending", progress: 0 });
          return;
        }
        patchItem(item.id, {
          status: "error",
          progress: 0,
          error: error instanceof Error ? error.message : "Échec de l'envoi.",
        });
      }
    });

    abortRef.current = null;
    setIsUploading(false);
  }

  function reset() {
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewsRef.current.clear();
    seenRef.current.clear();
    setItems([]);
    setRejected([]);
  }

  const allSent = items.length > 0 && sent.length === items.length;

  // ------------------------------------------------------------------
  // Écran de fin : tout est parti, on remercie et on propose de recommencer
  // ------------------------------------------------------------------
  if (allSent && !isUploading) {
    return (
      <section className="card border border-base-300 bg-base-100/80 backdrop-blur">
        <div className="card-body items-center gap-5 py-12 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-accent/15 text-accent">
            <CheckIcon className="size-8" />
          </span>
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-medium">
              Merci {sentName} !
            </h2>
            <p className="text-base-content/70">
              {sent.length === 1 ? (
                <>
                  {sent[0].video ? "Ta vidéo" : "Ta photo"} est bien arrivée.
                  Les mariés la retrouveront après la fête.
                </>
              ) : (
                <>
                  Tes {mediaCount(sent.length, videosIn(sent))} sont bien
                  arrivées. Les mariés les retrouveront après la fête.
                </>
              )}
            </p>
          </div>
          <button className="btn btn-primary btn-wide" onClick={reset}>
            Envoyer autre chose
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* -------------------------------------------------- Étape 1 : prénom */}
      <div className="card border border-base-300 bg-base-100/80 backdrop-blur">
        <div className="card-body gap-3 p-5 sm:p-6">
          <label className="flex items-center gap-2" htmlFor="guest-name">
            <StepBadge>1</StepBadge>
            <span className="font-display text-xl font-medium">Ton prénom</span>
          </label>
          <input
            id="guest-name"
            ref={nameRef}
            type="text"
            autoComplete="given-name"
            enterKeyHint="done"
            maxLength={MAX_NAME_LENGTH}
            placeholder="Alexandre/Séverine"
            className={`input input-lg w-full bg-base-100 ${nameError ? "input-error" : ""}`}
            defaultValue=""
            disabled={isUploading}
            onChange={() => {
              if (nameError) setNameError(false);
            }}
          />
          <p
            className={`text-sm ${nameError ? "text-error" : "text-base-content/60"}`}
          >
            {nameError
              ? "Indique ton prénom avant d'envoyer."
              : "En cas d'homonyme, ajoute l'initiale de ton nom de famille (ex : Alexandre T)."}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------- Étape 2 : photos */}
      <div className="card border border-base-300 bg-base-100/80 backdrop-blur">
        <div className="card-body gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <StepBadge>2</StepBadge>
            <span className="font-display text-xl font-medium">
              Tes photos et vidéos
            </span>
          </div>

          <button
            type="button"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDraggingOver(false);
              if (event.dataTransfer.files.length > 0) {
                addFiles(event.dataTransfer.files);
              }
            }}
            className={`flex w-full flex-col items-center gap-3 rounded-box border-2 border-dashed px-6 py-10 transition-colors ${
              isDraggingOver
                ? "border-primary bg-primary/10"
                : "border-base-300 bg-base-200/50 hover:border-primary/60 hover:bg-base-200"
            } disabled:opacity-50`}
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/12 text-primary">
              <CameraIcon className="size-7" />
            </span>
            <span className="text-pretty text-center font-display text-2xl font-medium">
              Clique pour parcourir, photographier ou filmer
            </span>
          </button>

          {/* Dit avant de filmer ce qui serait refusé après : une vidéo trop
              longue se découvrirait sinon au moment de l'envoi. */}
          <p className="text-center text-sm text-base-content/60">
            Photos et vidéos, jusqu&apos;à 150 Mo par fichier — soit environ
            deux minutes filmées en 1080p.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              // Permet de resélectionner le même fichier après l'avoir retiré
              event.target.value = "";
            }}
          />

          {rejected.length > 0 && (
            <div className="alert alert-warning alert-soft text-sm">
              <div className="space-y-1">
                <p className="font-medium">
                  {rejected.length === 1
                    ? "Un fichier a été écarté :"
                    : `${rejected.length} fichiers ont été écartés :`}
                </p>
                <ul className="list-inside list-disc opacity-90">
                  {rejected.slice(0, 4).map((line, index) => (
                    <li key={`${index}-${line}`}>{line}</li>
                  ))}
                  {rejected.length > 4 && <li>et {rejected.length - 4} autres…</li>}
                </ul>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <ul className="divide-y divide-base-300/70">
              {items.map((item) => (
                <FileRow
                  key={item.id}
                  item={item}
                  disabled={isUploading}
                  onRemove={() => removeItem(item)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* --------------------------------- Barre d'action, collée en bas sur mobile */}
      {items.length > 0 && (
        <div className="sticky bottom-4 z-10">
          <div className="rounded-box border border-base-300 bg-base-100/95 p-4 shadow-lg backdrop-blur">
            {isUploading ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-sm text-primary" />
                    Envoi en cours… {sent.length} / {items.length}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => abortRef.current?.abort()}
                  >
                    Arrêter
                  </button>
                </div>
                <progress
                  className="progress progress-primary w-full"
                  value={sent.length}
                  max={items.length}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  className="btn btn-primary btn-lg w-full"
                  onClick={startUpload}
                  disabled={pending.length === 0}
                >
                  {failed.length > 0
                    ? `Réessayer ${mediaCount(failed.length, videosIn(failed))}`
                    : `Envoyer ${mediaCount(pending.length, videosIn(pending))}`}
                </button>
                {sent.length > 0 && (
                  <p className="text-center text-sm text-base-content/60">
                    {mediaCount(sent.length, videosIn(sent))} déjà envoyée
                    {sent.length > 1 ? "s" : ""}.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function FileRow({
  item,
  disabled,
  onRemove,
}: {
  item: Item;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="relative size-12 shrink-0 overflow-hidden rounded-field bg-base-300">
        {/* Posée dessous : elle reste visible si l'aperçu manque, et aussi
            si le navigateur ne sait pas décoder le fichier (un .mov filmé en
            HEVC, par exemple, hors de Safari). */}
        <span className="absolute inset-0 flex items-center justify-center text-base-content/40">
          {item.video ? (
            <VideoIcon className="size-5" />
          ) : (
            <CameraIcon className="size-5" />
          )}
        </span>

        {item.preview &&
          (item.video ? (
            // « #t=0.1 » demande la première image plutôt qu'un cadre noir
            <video
              src={`${item.preview}#t=0.1`}
              muted
              playsInline
              preload="metadata"
              className="relative size-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- blob local, next/image ne sait pas l'optimiser
            <img
              src={item.preview}
              alt=""
              className="relative size-full object-cover"
              loading="lazy"
            />
          ))}

        {item.status === "done" && (
          <span className="absolute inset-0 flex items-center justify-center bg-accent/80 text-accent-content">
            <CheckIcon className="size-6" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.file.name}</p>

        {item.status === "uploading" ? (
          <progress
            className="progress progress-primary mt-1 h-1.5 w-full"
            value={item.progress}
            max={1}
          />
        ) : item.status === "error" ? (
          <p className="truncate text-xs text-error">{item.error}</p>
        ) : (
          <p className="text-xs text-base-content/50">
            {item.status === "done"
              ? "Envoyée"
              : `${item.video ? "Vidéo · " : ""}${formatBytes(item.file.size)}`}
          </p>
        )}
      </div>

      {item.status !== "done" && (
        <button
          type="button"
          className="btn btn-ghost btn-circle btn-sm"
          aria-label={`Retirer ${item.file.name}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <CloseIcon className="size-4" />
        </button>
      )}
    </li>
  );
}

function StepBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 font-display text-sm font-semibold text-primary">
      {children}
    </span>
  );
}
