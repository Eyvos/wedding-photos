import {
  ArchiveError,
  readArchiveRequest,
  resolveArchive,
} from "@/lib/archive-server";
import { ARCHIVE_CONCURRENCY, ARCHIVE_READAHEAD_BYTES } from "@/lib/config";
import { attachmentHeader, downloadError } from "@/lib/download";
import { downloadPhoto } from "@/lib/dropbox";
import type { Photo } from "@/lib/gallery";
import { createZipStream, uniqueEntryName, type ZipEntry } from "@/lib/zip";

/**
 * POST /api/download — une archive ZIP des photos demandées.
 *
 * Appelée par un formulaire ordinaire plutôt qu'en `fetch` : le navigateur
 * enregistre alors le fichier au fil de l'eau, sans jamais le garder en
 * mémoire, et la page d'où l'on vient reste affichée.
 *
 * Trois portées :
 *   scope=all                  → tout l'album
 *   scope=guests + guests=[…]  → les photos d'un ou plusieurs invités
 *   scope=photos + paths=[…]   → une sélection de photos
 *
 * Quoi qu'on demande, il n'en sort qu'un seul fichier : l'album entier tient
 * dans une archive plutôt que dans une série de morceaux à rassembler.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * Le temps de tirer l'album depuis Dropbox et de le réémettre. Valeur
 * littérale parce que Next l'analyse statiquement — elle doit rester égale à
 * `ARCHIVE_MAX_SECONDS`.
 */
export const maxDuration = 300;

/** Tentatives de lecture d'une photo avant de la sauter (la 1re incluse) */
const READ_ATTEMPTS = 3;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return downloadError("La demande n'a pas pu être lue.");
  }

  const wanted = readArchiveRequest(form);
  if (!wanted) return downloadError("Demande de téléchargement incomplète.");

  let archive;
  try {
    archive = await resolveArchive(wanted);
  } catch (error) {
    if (error instanceof ArchiveError) {
      return downloadError(error.message, error.status);
    }
    throw error;
  }

  const taken = new Set<string>();
  const entries: ZipEntry[] = archive.photos.map((photo) => ({
    name: uniqueEntryName(
      archive.flat ? photo.name : `${photo.guest}/${photo.name}`,
      taken,
    ),
    size: photo.size,
    modified: photo.uploadedAt ? new Date(photo.uploadedAt) : new Date(),
    read: () => readPhoto(photo),
  }));

  return new Response(
    createZipStream(entries, ARCHIVE_CONCURRENCY, ARCHIVE_READAHEAD_BYTES),
    {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": attachmentHeader(`${archive.name}.zip`),
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Charge une photo entière : le ZIP a besoin de sa taille et de son CRC avant
 * de pouvoir écrire son en-tête. Plusieurs photos sont lues de front (voir
 * `createZipStream`), mais jamais plus que `ARCHIVE_CONCURRENCY`.
 *
 * Un incident réseau isolé ne doit pas faire disparaître une photo de
 * l'archive : on réessaie avant d'abandonner.
 */
async function readPhoto(photo: Photo): Promise<Uint8Array> {
  let last: unknown;

  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt++) {
    try {
      const response = await downloadPhoto(photo.path);

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Dropbox ${response.status} : ${detail}`);
      }

      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      last = error;
      // Une pause courte et croissante : le temps qu'un pic de charge passe
      if (attempt < READ_ATTEMPTS) await wait(attempt * 250);
    }
  }

  throw last;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
