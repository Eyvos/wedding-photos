"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { mediaStreamUrl, photoDownloadUrl, thumbUrl } from "@/lib/browser-download";
import { isVideo, type PhotoCard } from "@/lib/gallery";

import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DownloadIcon,
  PlayIcon,
} from "./icons";
import { useImageState } from "./useImageState";

/**
 * Consultation plein écran, une photo à la fois.
 *
 * Le doigt fait défiler la pellicule : les photos sont posées côte à côte
 * dans une bande qu'on déplace, ce qui rend le glissement continu plutôt
 * que saccadé. Seules les images voisines sont chargées — passer devant
 * 200 photos ne doit pas en télécharger 200.
 *
 * Une vidéo se joue sur place, dans la même pellicule. Elle n'est chargée
 * que lorsqu'on est devant : les voisines n'affichent qu'un triangle, sinon
 * traverser l'album mettrait en route trois films à la fois.
 */

type Props = {
  photos: PhotoCard[];
  index: number;
  /** Photos que compte la source, chargées ou non */
  total: number;
  onIndexChange: (index: number) => void;
  /** Réclame la tranche suivante quand la fin de la pellicule approche */
  onNearEnd: () => void;
  onClose: () => void;
  isSelected: (photo: PhotoCard) => boolean;
  onToggleSelect: (photo: PhotoCard) => void;
  /** Photos cochées dans toute la grille, pas seulement ici */
  selectedCount: number;
};

/** Part de la largeur à parcourir pour valider un changement de photo */
const SWIPE_RATIO = 0.2;
/** …avec un plancher, pour que les petits écrans restent maniables */
const SWIPE_MIN = 50;

/** Photos gardées chargées de part et d'autre de celle qu'on regarde */
const NEIGHBOURS = 2;

/** Distance à la fin de la pellicule qui déclenche le chargement de la suite */
const LOAD_MARGIN = 5;

export default function Lightbox({
  photos,
  index,
  total,
  onIndexChange,
  onNearEnd,
  onClose,
  isSelected,
  onToggleSelect,
  selectedCount,
}: Props) {
  /** Décalage du doigt en cours, en pixels ; 0 quand rien n'est en cours */
  const [drag, setDrag] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  /**
   * Le même décalage, tenu à jour immédiatement. `onTouchEnd` décide à partir
   * de cette valeur : lire l'état reviendrait à parier sur un rendu React
   * intercalé entre le dernier mouvement et le lever du doigt.
   */
  const dragRef = useRef(0);

  const trackRef = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  /** Direction retenue au premier mouvement, pour ne pas hésiter ensuite */
  const axis = useRef<"horizontal" | "vertical" | null>(null);

  const photo = photos[index];

  const go = useCallback(
    (step: number) => {
      const next = index + step;
      if (next >= 0 && next < photos.length) onIndexChange(next);
    },
    [index, photos.length, onIndexChange],
  );

  // On approche du bout de ce qui est chargé : la suite arrive avant qu'on
  // n'y soit, pour que la pellicule ne s'arrête pas net au milieu de l'album.
  useEffect(() => {
    if (photos.length < total && index >= photos.length - LOAD_MARGIN) {
      onNearEnd();
    }
  }, [index, photos.length, total, onNearEnd]);

  // Flèches et Échap : la même navigation, au clavier
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go, onClose]);

  // La page derrière ne doit pas défiler pendant qu'on regarde les photos
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    origin.current = { x: touch.clientX, y: touch.clientY };
    axis.current = null;
    setIsDragging(true);
  }

  function onTouchMove(event: React.TouchEvent) {
    if (!origin.current) return;

    const touch = event.touches[0];
    const dx = touch.clientX - origin.current.x;
    const dy = touch.clientY - origin.current.y;

    if (!axis.current) {
      // Sous 8 px, le geste est encore trop court pour être interprété
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }

    if (axis.current !== "horizontal") return;

    // Aux deux bouts de la pellicule, le glissement résiste : on sent
    // qu'il n'y a plus rien derrière sans être bloqué net.
    const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === photos.length - 1);
    dragRef.current = atEdge ? dx / 3 : dx;
    setDrag(dragRef.current);
  }

  function onTouchEnd() {
    const width = trackRef.current?.clientWidth ?? 1;
    const threshold = Math.max(width * SWIPE_RATIO, SWIPE_MIN);
    const travelled = dragRef.current;

    if (travelled <= -threshold) go(1);
    else if (travelled >= threshold) go(-1);

    origin.current = null;
    axis.current = null;
    dragRef.current = 0;
    setDrag(0);
    setIsDragging(false);
  }

  const selected = isSelected(photo);

  return (
    <div
      className="viewer fixed inset-0 z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`${isVideo(photo) ? "Vidéo" : "Photo"} ${index + 1} sur ${total}, envoyée par ${photo.guest}`}
    >
      <header className="flex items-start justify-between gap-3 px-3 pt-3">
        <button
          type="button"
          className="btn btn-ghost btn-circle text-current"
          onClick={onClose}
          aria-label="Fermer"
        >
          <CloseIcon className="size-5" />
        </button>

        <div className="min-w-0 pt-1 text-center">
          <p className="truncate font-display text-xl leading-tight">
            {photo.guest}
          </p>
          <p className="text-xs opacity-60">
            {index + 1} / {total}
          </p>
        </div>

        {/* Contrepoids du bouton de fermeture, pour garder le titre centré */}
        <span className="size-12 shrink-0" aria-hidden="true" />
      </header>

      <div
        ref={trackRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ touchAction: "pan-y" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div
          className="flex h-full"
          style={{
            transform: `translate3d(calc(${-index * 100}% + ${drag}px), 0, 0)`,
            transition: isDragging ? "none" : "transform 260ms ease-out",
          }}
        >
          {photos.map((current, position) => (
            <div
              key={current.path}
              className="flex h-full w-full shrink-0 items-center justify-center p-2"
            >
              {/* Seules la photo affichée et ses voisines sont chargées */}
              {Math.abs(position - index) <= NEIGHBOURS &&
                (isVideo(current) ? (
                  <VideoFrame photo={current} active={position === index} />
                ) : (
                  <Frame photo={current} active={position === index} />
                ))}
            </div>
          ))}
        </div>

        {/* À la souris, le glissement n'a pas de sens : deux flèches font l'affaire */}
        <button
          type="button"
          className="btn btn-circle btn-ghost absolute left-2 top-1/2 hidden -translate-y-1/2 text-current sm:inline-flex"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="Précédente"
        >
          <ChevronLeftIcon className="size-6" />
        </button>
        <button
          type="button"
          className="btn btn-circle btn-ghost absolute right-2 top-1/2 hidden -translate-y-1/2 text-current sm:inline-flex"
          onClick={() => go(1)}
          disabled={index === photos.length - 1}
          aria-label="Suivante"
        >
          <ChevronRightIcon className="size-6" />
        </button>
      </div>

      <footer className="flex items-center justify-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          className={`btn btn-sm ${selected ? "btn-accent" : "btn-outline text-current"}`}
          onClick={() => onToggleSelect(photo)}
          aria-pressed={selected}
        >
          <CheckIcon className="size-4" />
          {selected ? "Sélectionnée" : "Sélectionner"}
          {/* Ce qu'on emportera si on s'arrête là — visible sans fermer la photo */}
          {selectedCount > 0 && <span className="opacity-70">({selectedCount})</span>}
        </button>

        <a
          className="btn btn-sm btn-primary"
          href={photoDownloadUrl(photo)}
          download={photo.name}
        >
          <DownloadIcon className="size-4" />
          Télécharger
        </a>
      </footer>
    </div>
  );
}

/**
 * Une photo de la pellicule.
 *
 * La vignette de la grille est déjà dans le cache du navigateur : elle
 * s'affiche instantanément, floutée et agrandie, pendant que la grande
 * version arrive. On voit tout de suite *quelle* photo on regarde, et
 * l'attente n'est plus un carré noir.
 */
function Frame({ photo, active }: { photo: PhotoCard; active: boolean }) {
  const { state, bind } = useImageState();
  const loaded = state !== "loading";

  return (
    <div className="relative flex size-full items-center justify-center">
      {!loaded && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- aperçu déjà en cache */}
          <img
            src={thumbUrl(photo, "w256h256")}
            alt=""
            aria-hidden
            className="absolute max-h-full max-w-full scale-105 select-none object-contain opacity-45 blur-xl"
            draggable={false}
          />
          {active && (
            <span
              className="loading loading-spinner loading-lg absolute opacity-70"
              aria-label="Chargement de la photo"
            />
          )}
        </>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element -- déjà redimensionnée par Dropbox, next/image n'apporterait rien */}
      <img
        {...bind}
        src={thumbUrl(photo, "w1024h768", "bestfit")}
        alt={`Photo envoyée par ${photo.guest}`}
        className="relative max-h-full max-w-full select-none object-contain"
        draggable={false}
      />
    </div>
  );
}

/**
 * Une vidéo de la pellicule.
 *
 * `preload="metadata"` ne va chercher que l'en-tête du fichier : de quoi
 * connaître la durée et afficher la barre de lecture, sans tirer le film
 * entier de Dropbox pour quelqu'un qui ne fait que passer devant.
 *
 * Les gestes s'arrêtent sur le lecteur : sans cela, tirer la barre de
 * progression ferait aussi glisser la pellicule vers la vidéo suivante. Le
 * glissement reste possible de part et d'autre de l'image.
 */
function VideoFrame({ photo, active }: { photo: PhotoCard; active: boolean }) {
  const [failed, setFailed] = useState(false);
  const stop = (event: React.TouchEvent) => event.stopPropagation();

  // Une vidéo filmée en HEVC — le réglage d'usine de l'iPhone — se lit dans
  // Safari mais pas dans tous les navigateurs. Le fichier, lui, est intact :
  // plutôt qu'un lecteur noir, on propose de l'emporter.
  if (active && failed) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-white/10">
          <PlayIcon className="size-8 opacity-50" />
        </span>
        <p className="text-pretty text-sm opacity-70">
          Ce navigateur ne sait pas lire cette vidéo. Elle est intacte : en la
          téléchargeant, elle s&apos;ouvrira normalement.
        </p>
        <a
          className="btn btn-sm btn-primary"
          href={photoDownloadUrl(photo)}
          download={photo.name}
        >
          <DownloadIcon className="size-4" />
          Télécharger la vidéo
        </a>
      </div>
    );
  }

  return (
    <div className="flex size-full items-center justify-center">
      {active ? (
        <video
          src={mediaStreamUrl(photo)}
          controls
          playsInline
          preload="metadata"
          aria-label={`Vidéo envoyée par ${photo.guest}`}
          className="max-h-full max-w-full"
          onError={() => setFailed(true)}
          onTouchStart={stop}
          onTouchMove={stop}
          onTouchEnd={stop}
        />
      ) : (
        <span className="flex size-24 items-center justify-center rounded-full bg-white/10">
          <PlayIcon className="size-10 opacity-60" />
        </span>
      )}
    </div>
  );
}
