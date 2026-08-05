/**
 * Tout ce qui est propre au mariage se règle ici.
 * Ce fichier est importé côté serveur ET côté navigateur : n'y mettre
 * aucun secret (les tokens Dropbox vivent dans les variables d'env).
 */

export const WEDDING = {
  /** Prénoms affichés en grand sur la page d'accueil */
  brideAndGroom: ["Alex", "Séve"] as const,
  /** Date lisible affichée sous les prénoms */
  dateLabel: "Samedi 8 août 2026",
  /** Version machine, pour les balises <time> et le nom des dossiers */
  dateISO: "2026-08-08",
} as const;

export const COUPLE = WEDDING.brideAndGroom.join(" & ");

/**
 * Extensions acceptées. Photos uniquement — les vidéos de mariage
 * dépassent vite la limite de 150 Mo des liens d'upload temporaires.
 * Pour les autoriser malgré tout : ajouter "mp4", "mov" ci-dessous et
 * les types correspondants dans ACCEPT_ATTRIBUTE.
 */
export const ALLOWED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "heic",
  "heif",
  "webp",
  "gif",
  "avif",
] as const;

/** Valeur de l'attribut `accept` du <input type="file"> */
export const ACCEPT_ATTRIBUTE = "image/*";

/** Limite dure de l'API Dropbox `get_temporary_upload_link` : 150 Mo */
export const MAX_FILE_SIZE = 150 * 1024 * 1024;

/** Nombre d'uploads menés de front — 3 sature moins la 4G d'une salle */
export const UPLOAD_CONCURRENCY = 3;

/** Tentatives par fichier (la 1re incluse) avant d'abandonner */
export const MAX_ATTEMPTS = 3;

export const MAX_NAME_LENGTH = 40;

/** Extension d'un nom de fichier, en minuscules, sans le point */
export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function isAllowedFile(filename: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(
    fileExtension(filename),
  );
}
