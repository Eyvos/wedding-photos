/**
 * Résolution d'une demande d'archive — **serveur uniquement** (ce module
 * touche à Dropbox ; il n'a rien à faire dans le bundle du navigateur).
 *
 * Les deux routes de téléchargement en partent : celle qui annonce ce que
 * pèse la demande et celle qui envoie l'archive.
 */

import type { ArchivePlan, ArchiveRequest } from "./archive";
import { listGuests } from "./dropbox";
import { guestCount, isVideo, mediaCount, type Photo } from "./gallery";

export type ResolvedArchive = {
  /** Toutes les photos concernées, dans un ordre stable */
  photos: Photo[];
  /** Nom de l'archive, sans numéro de partie ni extension */
  name: string;
  /**
   * Une seule personne concernée : ses photos vont à la racine de l'archive
   * plutôt que dans un sous-dossier à son nom, qui ne distinguerait rien.
   */
  flat: boolean;
  plan: ArchivePlan;
};

/** La demande est illisible ou ne désigne aucune photo. */
export class ArchiveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Lit une demande d'archive dans les champs d'un formulaire. */
export function readArchiveRequest(form: FormData): ArchiveRequest | null {
  const scope = form.get("scope");

  if (scope === "all") return { scope: "all" };
  if (scope === "guests") return { scope: "guests", guests: parseList(form.get("guests")) };
  if (scope === "photos") return { scope: "photos", paths: parseList(form.get("paths")) };

  return null;
}

export async function resolveArchive(
  request: ArchiveRequest,
): Promise<ResolvedArchive> {
  const guests = await listGuests().catch((error: unknown) => {
    console.error("archive : listing impossible —", error);
    return null;
  });

  if (!guests) {
    throw new ArchiveError(
      "L'album est momentanément injoignable. Réessaie dans un instant.",
      502,
    );
  }

  let photos: Photo[];
  let name = "Photos du mariage";
  let flat = false;

  if (request.scope === "all") {
    photos = guests.flatMap((guest) => guest.photos);
  } else if (request.scope === "guests") {
    const wanted = new Set(request.guests);
    const selection = guests.filter((guest) => wanted.has(guest.name));

    photos = selection.flatMap((guest) => guest.photos);
    flat = selection.length === 1;
    name =
      selection.length === 1
        ? `Photos - ${selection[0].name}`
        : `Photos - ${guestCount(selection.length)}`;
  } else {
    const wanted = new Set(request.paths);
    // On repart du catalogue : un chemin inconnu est écarté au passage.
    photos = guests
      .flatMap((guest) => guest.photos)
      .filter((photo) => wanted.has(photo.path));

    flat = new Set(photos.map((photo) => photo.guest)).size <= 1;
    name = `Photos - ${mediaCount(photos.length, photos.filter(isVideo).length)}`;
  }

  if (photos.length === 0) {
    throw new ArchiveError("Aucune photo ne correspond à cette demande.", 404);
  }

  return {
    photos,
    name,
    flat,
    plan: {
      name,
      count: photos.length,
      size: photos.reduce((sum, photo) => sum + photo.size, 0),
    },
  };
}

/** Champ de formulaire contenant un tableau JSON de chaînes. */
function parseList(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
