"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ACCEPT_ATTRIBUTE,
  MAX_FILE_SIZE,
  MAX_NAME_LENGTH,
  isAllowedFile,
} from "@/lib/config";
import { runPool, uploadFile } from "@/lib/upload";

type Status = "pending" | "uploading" | "done" | "error";

type Item = {
  id: string;
  file: File;
  /** objectURL pour la vignette, ou null si le format n'est pas affichable */
  preview: string | null;
  status: Status;
  progress: number;
  error?: string;
};

const NAME_STORAGE_KEY = "wedding-photos:guest-name";

/** Les HEIC d'iPhone ne s'affichent pas dans un <img> : pas de vignette. */
const PREVIEWABLE = /^image\/(jpeg|png|gif|webp|avif)$/;

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
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
        refused.push(`${file.name} — ce n'est pas une photo`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        refused.push(`${file.name} — trop lourde (150 Mo maximum)`);
        continue;
      }

      seenRef.current.add(key);

      let preview: string | null = null;
      if (PREVIEWABLE.test(file.type)) {
        preview = URL.createObjectURL(file);
        previewsRef.current.add(preview);
      }

      additions.push({
        id: key,
        file,
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
              {sent.length === 1
                ? "Ta photo est bien arrivée."
                : `Tes ${sent.length} photos sont bien arrivées.`}{" "}
              Les mariés les retrouveront après la fête.
            </p>
          </div>
          <button className="btn btn-primary btn-wide" onClick={reset}>
            Envoyer d&apos;autres photos
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
            <span className="font-display text-xl font-medium">Tes photos</span>
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
              Clique pour parcourir ou prendre directement une photo
            </span>
          </button>

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
                    ? `Réessayer ${failed.length} photo${failed.length > 1 ? "s" : ""}`
                    : `Envoyer ${pending.length} photo${pending.length > 1 ? "s" : ""}`}
                </button>
                {sent.length > 0 && (
                  <p className="text-center text-sm text-base-content/60">
                    {sent.length} photo{sent.length > 1 ? "s" : ""} déjà envoyée
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
        {item.preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob local, next/image ne sait pas l'optimiser
          <img
            src={item.preview}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-base-content/40">
            <CameraIcon className="size-5" />
          </span>
        )}
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
            {item.status === "done" ? "Envoyée" : formatSize(item.file.size)}
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

/* --------------------------- Icônes (inline, aucune dépendance) ----------- */

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2a1 1 0 0 0 .83-.45l.94-1.4A1 1 0 0 1 9.3 3.7h5.4a1 1 0 0 1 .83.45l.94 1.4A1 1 0 0 0 17.3 6h1.2A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 13 4.5 4.5L19 7" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
