/**
 * Le vocabulaire de la galerie, partagé entre le serveur et le navigateur.
 * Aucun accès Dropbox ici : ce fichier part dans le bundle client.
 *
 * Le mot « dossier » n'apparaît nulle part côté interface — pour un invité,
 * il n'y a que des invités et leurs photos.
 *
 * « Photo » désigne ici n'importe quel souvenir de l'album, vidéos comprises :
 * les deux se listent, se cochent et se téléchargent exactement pareil. Là où
 * la différence compte — vignette, affichage plein écran, libellés —, on la
 * lit dans l'extension du chemin, via `isVideo`.
 */

import { isVideoFile } from "./config";

export type Photo = {
  /** Chemin Dropbox : identifiant stable d'une photo dans toute l'app */
  path: string;
  /** Nom lisible, débarrassé du préfixe horodaté ajouté à l'envoi */
  name: string;
  /** Prénom de l'invité qui l'a déposée */
  guest: string;
  size: number;
  /** Arrivée dans l'album, en ISO — sert au tri chronologique */
  uploadedAt: string;
};

/**
 * Une vidéo plutôt qu'une photo ? Rien n'est transmis pour le dire : le
 * chemin porte déjà l'extension, et la recopier dans chaque carte coûterait
 * un champ de plus par souvenir sur un album qui en compte des milliers.
 */
export function isVideo(photo: Pick<Photo, "path">): boolean {
  return isVideoFile(photo.path);
}

/**
 * Ce qu'une vignette a besoin de savoir pour s'afficher, s'ouvrir et se
 * faire cocher. Le poids et la date restent au serveur : multipliés par
 * quelques milliers de photos, ils pèsent plus lourd que le reste réuni.
 */
export type PhotoCard = Pick<Photo, "path" | "name" | "guest">;

export function toCard({ path, name, guest }: Photo): PhotoCard {
  return { path, name, guest };
}

/** D'où viennent les photos d'une grille : l'album entier, ou un invité. */
export type PhotoSource = { scope: "all" } | { scope: "guest"; slug: string };

/** Une tranche de grille, telle que la renvoie `/api/gallery`. */
export type PhotoPage = {
  photos: PhotoCard[];
  /** Total de la source, pour savoir s'il reste quelque chose à charger */
  total: number;
};

export type Guest = {
  name: string;
  /** Identifiant d'URL, sans accent ni espace */
  slug: string;
  photos: Photo[];
  /** Combien, parmi `photos`, sont des vidéos — pour les libellés */
  videos: number;
  /** Poids cumulé des photos de l'invité */
  size: number;
};

/**
 * Ce que la liste des invités a besoin de savoir : de quoi dessiner une
 * carte, et rien de plus.
 *
 * La différence n'est pas cosmétique. Envoyer les `Guest` complets au
 * navigateur, c'est y recopier chaque chemin, chaque nom et chaque date de
 * l'album entier — plusieurs centaines de kilo-octets dès que la fête a été
 * bien photographiée, pour afficher quarante cartes.
 */
export type GuestSummary = {
  name: string;
  slug: string;
  /** Nombre de photos déposées, vidéos comprises */
  count: number;
  /** Combien de ces dépôts sont des vidéos */
  videos: number;
  size: number;
  /** Chemins des quelques photos de la mosaïque d'aperçu */
  preview: string[];
};

export function summarize(guest: Guest, previewCount: number): GuestSummary {
  return {
    name: guest.name,
    slug: guest.slug,
    count: guest.photos.length,
    videos: guest.videos,
    size: guest.size,
    // Une vidéo n'a pas de vignette à montrer : la mosaïque se compose des
    // seules photos, quitte à rester vide pour qui n'a envoyé que des films.
    preview: guest.photos
      .filter((photo) => !isVideo(photo))
      .slice(0, previewCount)
      .map((photo) => photo.path),
  };
}

/** Invités dont on ne connaît pas le prénom (photos déposées hors dossier) */
export const UNKNOWN_GUEST = "Invité anonyme";

/**
 * Préfixe posé sur chaque fichier à l'envoi (voir `api/upload-link`) :
 * il garantit l'unicité et l'ordre, mais n'a rien à faire sous une photo.
 */
const STAMP_PREFIX = /^\d{4}-\d{2}-\d{2}T[\d-]+Z_/;

export function mediaDisplayName(filename: string): string {
  return filename.replace(STAMP_PREFIX, "");
}

/** Prénom → segment d'URL : « Élodie B. » devient « elodie-b ». */
export function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      // Retire les diacritiques laissés seuls par la décomposition NFD
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "invite"
  );
}

export function totalPhotos(guests: Guest[]): number {
  return guests.reduce((sum, guest) => sum + guest.photos.length, 0);
}

export function totalVideos(guests: Guest[]): number {
  return guests.reduce((sum, guest) => sum + guest.videos, 0);
}

export function totalSize(guests: Guest[]): number {
  return guests.reduce((sum, guest) => sum + guest.size, 0);
}

/**
 * Toutes les photos, tous invités confondus, dans l'ordre d'arrivée.
 * C'est la vue « en vrac » : on retrouve la soirée telle qu'elle s'est
 * déroulée plutôt que rangée par prénom.
 */
export function allPhotos(guests: Guest[]): Photo[] {
  return guests
    .flatMap((guest) => guest.photos)
    .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
}

export function findGuest(guests: Guest[], slug: string): Guest | undefined {
  return guests.find((guest) => guest.slug === slug);
}

/**
 * Les photos que désigne une grille, dans leur ordre d'affichage.
 * Une source qui ne correspond à personne ne renvoie rien plutôt que tout.
 */
export function photosOf(guests: Guest[], source: PhotoSource): Photo[] {
  if (source.scope === "all") return allPhotos(guests);
  return findGuest(guests, source.slug)?.photos ?? [];
}

/** « 3 photos », « 1 photo » — l'accord au bon endroit, partout pareil */
export function photoCount(count: number): string {
  return `${count} photo${count > 1 ? "s" : ""}`;
}

export function videoCount(count: number): string {
  return `${count} vidéo${count > 1 ? "s" : ""}`;
}

/**
 * Le décompte d'un ensemble mêlant les deux : « 12 photos et 2 vidéos ».
 * On ne nomme les vidéos que s'il y en a — annoncer « 12 photos et 0 vidéo »
 * à un album qui n'en contient aucune serait du bruit.
 *
 * `total` compte tout, `videos` en est une part : c'est ce que les pages ont
 * sous la main sans avoir à parcourir l'album une fois de plus.
 */
export function mediaCount(total: number, videos: number): string {
  const photos = total - videos;

  if (videos === 0) return photoCount(photos);
  if (photos === 0) return videoCount(videos);

  return `${photoCount(photos)} et ${videoCount(videos)}`;
}

export function guestCount(count: number): string {
  return `${count} invité${count > 1 ? "s" : ""}`;
}
