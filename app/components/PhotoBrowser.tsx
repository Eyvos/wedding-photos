"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ArchiveRequest } from "@/lib/archive";
import { GALLERY_PAGE_SIZE, formatBytes } from "@/lib/config";
import {
  isVideo,
  mediaCount,
  type PhotoCard,
  type PhotoPage,
  type PhotoSource,
} from "@/lib/gallery";

import ActionBar from "./ActionBar";
import ArchiveDialog from "./ArchiveDialog";
import Lightbox from "./Lightbox";
import SelectMark from "./SelectMark";
import Thumb from "./Thumb";
import { DownloadIcon } from "./icons";
import { useArchiveDownload } from "./useArchiveDownload";

/**
 * Une grille de photos : on clique pour regarder, on coche pour emporter.
 *
 * Sert aussi bien à l'album entier qu'aux photos d'un seul invité — seul
 * le bouton « tout prendre » change de portée.
 *
 * La grille ne connaît au départ qu'une tranche de l'album, et va chercher
 * la suivante quand on approche du bas. Un mariage bien photographié, c'est
 * quelques milliers de photos : les envoyer et les dessiner toutes d'un coup
 * ferait ramer le téléphone avant même la première image.
 */

type Props = {
  /** Première tranche, déjà rendue par le serveur */
  initial: PhotoCard[];
  /** Nombre total de photos de la source */
  total: number;
  /** Combien de ces photos sont des vidéos — pour le décompte affiché */
  videos: number;
  /** Poids cumulé, connu du serveur seul puisqu'il a tout le catalogue */
  size: number;
  /** Où aller chercher les tranches suivantes */
  source: PhotoSource;
  /** Ce que télécharge le bouton d'ensemble, et son libellé */
  everything: { request: ArchiveRequest; label: string };
};

export default function PhotoBrowser({
  initial,
  total,
  videos,
  size,
  source,
  everything,
}: Props) {
  const [photos, setPhotos] = useState<PhotoCard[]>(initial);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  /** Chemins des photos cochées — le chemin est l'identité d'une photo */
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  /** Position dans la pellicule, ou `null` quand on est sur la grille */
  const [openAt, setOpenAt] = useState<number | null>(null);

  const download = useArchiveDownload();

  /** Sentinelle posée sous la grille : la voir, c'est demander la suite */
  const sentinel = useRef<HTMLDivElement>(null);
  /** Nombre de photos déjà chargées, lisible sans redéclencher les effets */
  const loadedCount = useRef(initial.length);
  const inFlight = useRef(false);

  const hasMore = photos.length < total;

  // `source` est un objet littéral : il change d'identité à chaque rendu.
  // En dépendre rebrancherait l'observateur sans arrêt ; on n'en garde donc
  // que les deux valeurs qui comptent vraiment.
  const scope = source.scope;
  const slug = source.scope === "guest" ? source.slug : null;

  const loadMore = useCallback(async () => {
    if (inFlight.current || loadedCount.current >= total) return;

    inFlight.current = true;
    setLoading(true);
    setLoadError(false);

    const params = new URLSearchParams({
      scope,
      offset: String(loadedCount.current),
      limit: String(GALLERY_PAGE_SIZE),
    });
    if (slug) params.set("slug", slug);

    try {
      const response = await fetch(`/api/gallery?${params}`);
      if (!response.ok) throw new Error(String(response.status));

      const page = (await response.json()) as PhotoPage;

      setPhotos((current) => {
        // Deux appels concurrents ne doivent pas recopier la même tranche
        const known = new Set(current.map((photo) => photo.path));
        const merged = [
          ...current,
          ...page.photos.filter((photo) => !known.has(photo.path)),
        ];
        loadedCount.current = merged.length;
        return merged;
      });
    } catch (error) {
      console.error("galerie : tranche suivante indisponible —", error);
      setLoadError(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [scope, slug, total]);

  // Le bas de la grille approche : on charge la suite avant d'y arriver,
  // pour que le défilement ne bute jamais sur du vide.
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasMore || loadError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "1200px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadError, loadMore]);

  const toggle = useCallback((photo: PhotoCard) => {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(photo.path)) next.add(photo.path);
      return next;
    });
  }, []);

  const isSelected = useCallback(
    (photo: PhotoCard) => selected.has(photo.path),
    [selected],
  );

  /** Le chemin suffit à reconnaître une vidéo : son extension y est */
  const selectedVideos = useMemo(
    () => [...selected].filter((path) => isVideo({ path })).length,
    [selected],
  );

  if (total === 0) {
    return (
      <p className="rounded-box border border-dashed border-base-300 px-6 py-16 text-center text-base-content/60">
        Rien à voir pour le moment.
      </p>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-base-content/60">
          {mediaCount(total, videos)} · {formatBytes(size)}
        </p>
        <button
          type="button"
          className="btn btn-sm btn-outline border-base-300 font-normal"
          onClick={() => download.start(everything.request)}
          disabled={download.pending}
        >
          {download.pending ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              Préparation…
            </>
          ) : (
            <>
              <DownloadIcon className="size-4" />
              {everything.label}
            </>
          )}
        </button>
      </div>

      <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">
        {photos.map((photo, index) => {
          const kind = isVideo(photo) ? "vidéo" : "photo";

          return (
          <li key={photo.path} className="tile-square relative">
            {/* Au survol : la photo avance d'un cheveu et un liseré s'allume.
                Le zoom seul passait inaperçu — il fallait quelque chose qui
                dise « ceci s'ouvre » avant même d'avoir cliqué. */}
            <button
              type="button"
              className="group block size-full cursor-pointer overflow-hidden rounded-field bg-base-200 ring-primary/0 ring-offset-1 ring-offset-base-100 transition duration-200 hover:ring-2 hover:ring-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              onClick={() => setOpenAt(index)}
              aria-label={`Ouvrir la ${kind} envoyée par ${photo.guest}`}
            >
              <span className="block size-full transition-transform duration-300 group-hover:scale-105">
                <Thumb
                  photo={photo}
                  size="w256h256"
                  alt={`${kind === "vidéo" ? "Vidéo" : "Photo"} envoyée par ${photo.guest}`}
                  eager={index < 12}
                />
              </span>
            </button>

            <SelectMark
              checked={isSelected(photo)}
              onChange={() => toggle(photo)}
              label={`Sélectionner la ${kind} de ${photo.guest}`}
              className="absolute right-1.5 top-1.5"
            />
          </li>
          );
        })}

        {/* Les cases à venir : la grille garde sa hauteur pendant le chargement */}
        {loading &&
          Array.from({ length: Math.min(GALLERY_PAGE_SIZE, total - photos.length) }).map(
            (_, index) => (
              <li key={`attente-${index}`}>
                <div className="skeleton aspect-square w-full rounded-field" />
              </li>
            ),
          )}
      </ul>

      {hasMore && (
        <div ref={sentinel} className="py-8 text-center">
          {loadError ? (
            <button
              type="button"
              className="btn btn-sm btn-outline border-base-300 font-normal"
              onClick={() => void loadMore()}
            >
              Réessayer de charger la suite
            </button>
          ) : (
            <p
              className="flex items-center justify-center gap-2 text-sm text-base-content/50"
              aria-live="polite"
            >
              <span className="loading loading-spinner loading-xs" />
              Chargement de la suite…
            </p>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <ActionBar
          summary={`${mediaCount(selected.size, selectedVideos)} sélectionnée${selected.size > 1 ? "s" : ""}`}
          pending={download.pending}
          onClear={() => setSelected(new Set())}
          onDownload={() =>
            download.start({ scope: "photos", paths: [...selected] })
          }
        />
      )}

      {openAt !== null && (
        <Lightbox
          photos={photos}
          index={openAt}
          total={total}
          onIndexChange={setOpenAt}
          onNearEnd={loadMore}
          onClose={() => setOpenAt(null)}
          isSelected={isSelected}
          onToggleSelect={toggle}
          selectedCount={selected.size}
        />
      )}

      <ArchiveDialog download={download} />
    </>
  );
}
