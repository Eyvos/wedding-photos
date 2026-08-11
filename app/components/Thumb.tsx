"use client";

import { thumbUrl } from "@/lib/browser-download";
import { isVideo, type PhotoCard } from "@/lib/gallery";

import { PlayIcon } from "./icons";
import { useImageState } from "./useImageState";

/**
 * Une vignette et son attente.
 *
 * Tant que l'image n'est pas là, la case n'est pas vide : elle respire
 * doucement. C'est la différence entre « ça charge » et « c'est cassé »,
 * et sur un album de plusieurs milliers de photos, il y a toujours quelque
 * chose en train de charger quelque part.
 *
 * L'attente est posée *derrière* l'image, jamais par-dessus : une image pas
 * encore chargée ne peint rien, l'animation se voit donc au travers, et
 * l'image apparaît d'elle-même. Faire l'inverse — masquer l'image puis la
 * révéler par une transition d'opacité — laisse la vignette invisible si la
 * transition est gelée, ce qui arrive dans un sous-arbre que le navigateur
 * a mis de côté (voir `content-visibility` dans globals.css).
 */

type Props = {
  photo: PhotoCard;
  size: "w256h256" | "w640h480" | "w1024h768";
  /** Texte alternatif ; vide pour une image purement décorative */
  alt: string;
  /**
   * Les premières vignettes de la grille sont chargées sans attendre : ce
   * sont elles qu'on voit en arrivant. Les autres attendent le défilement.
   */
  eager?: boolean;
};

export default function Thumb({ photo, size, alt, eager }: Props) {
  const { state, bind } = useImageState();

  // Dropbox ne vignette pas les vidéos, et en tirer une image de la première
  // seconde coûterait le téléchargement du film pour chaque case de la
  // grille. Un carré sombre et un triangle disent la même chose : ça se
  // regarde, et ça bouge.
  if (isVideo(photo)) {
    return (
      <span
        className="flex size-full items-center justify-center bg-neutral text-neutral-content"
        role="img"
        aria-label={alt}
      >
        <PlayIcon className="w-1/3 opacity-80" />
      </span>
    );
  }

  return (
    <span className="relative block size-full overflow-hidden bg-base-200">
      {state === "loading" && (
        <span className="skeleton absolute inset-0 rounded-none" aria-hidden />
      )}

      {state === "failed" ? (
        <span
          className="absolute inset-0 flex items-center justify-center text-lg text-base-content/25"
          aria-hidden
        >
          ✕
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- vignette déjà taillée par Dropbox
        <img
          {...bind}
          src={thumbUrl(photo, size)}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={eager ? "high" : "auto"}
          draggable={false}
          className="relative size-full object-cover"
        />
      )}
    </span>
  );
}
