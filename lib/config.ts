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

/* -------------------------------------------------------------------------- */
/* Consultation : de quoi tenir avec beaucoup de photos                        */
/* -------------------------------------------------------------------------- */

/**
 * Photos posées d'un coup dans la grille. La page en rend une tranche, puis
 * la suivante quand on approche du bas : un album de 5 000 photos n'a aucune
 * raison de fabriquer 5 000 balises au premier affichage.
 */
export const GALLERY_PAGE_SIZE = 60;

/** Aperçu affiché sur la carte d'un invité : quatre photos donnent le ton */
export const GUEST_PREVIEW_COUNT = 4;

/**
 * Durée de vie maximale de la fonction qui fabrique une archive, en secondes.
 *
 * Une demande part toujours en **un seul fichier**, si gros soit-il : c'est
 * ce temps-là qui décide si elle aboutit. Le ZIP est écrit vers le visiteur
 * au fur et à mesure, donc la fonction reste ouverte tant qu'il n'a pas tout
 * reçu — 300 s laissent passer plusieurs centaines de mégaoctets même sur
 * une connexion modeste. C'est aussi le plafond de tous les plans Vercel
 * (fluid compute, activé par défaut) ; s'il était désactivé, le compte
 * gratuit retomberait à 60 s et il faudrait aligner cette valeur.
 *
 * Doit rester en accord avec le `maxDuration` exporté par
 * `app/api/download/route.ts`.
 */
export const ARCHIVE_MAX_SECONDS = 300;

/**
 * Photos tirées de Dropbox en parallèle pendant la fabrication d'une archive.
 * L'attente réseau domine largement : sans parallélisme, l'archive avance à
 * la vitesse d'un aller-retour par photo.
 */
export const ARCHIVE_CONCURRENCY = 6;

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

/** Type MIME déduit de l'extension, pour servir une photo telle quelle. */
export function imageMimeType(filename: string): string {
  const extension = fileExtension(filename);
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "heic" || extension === "heif") return `image/${extension}`;
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(extension)
    ? `image/${extension}`
    : "application/octet-stream";
}

/** Taille lisible : « 850 Ko », « 4,2 Mo », « 1,3 Go » */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1).replace(".", ",")} Go`;
}
