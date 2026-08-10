/**
 * Le vocabulaire des archives, partagé entre le serveur et le navigateur.
 * Aucun accès Dropbox ici : ce fichier part dans le bundle client.
 *
 * Une demande donne une archive, et une seule : recevoir un fichier et
 * l'ouvrir est déjà bien assez de manipulations pour qui veut simplement
 * garder les photos du mariage. La contrepartie est le temps — voir
 * `ARCHIVE_MAX_SECONDS`, qui borne la fabrication.
 */

export type ArchiveRequest =
  | { scope: "all" }
  | { scope: "guests"; guests: string[] }
  | { scope: "photos"; paths: string[] };

/** Ce que pèse une demande, avant d'aller la chercher. */
export type ArchivePlan = {
  /** Nom de fichier, sans l'extension */
  name: string;
  count: number;
  size: number;
};
