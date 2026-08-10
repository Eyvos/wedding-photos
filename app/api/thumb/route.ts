import { immutableImageHeaders, transientErrorHeaders } from "@/lib/cache-headers";
import { imageMimeType } from "@/lib/config";
import {
  THUMBNAIL_SIZES,
  downloadPhoto,
  getThumbnail,
  isPhotoPath,
  type ThumbnailSize,
} from "@/lib/dropbox";

/**
 * GET /api/thumb?path=…&size=w256h256&mode=strict
 *
 * Relaie une vignette générée par Dropbox. Le navigateur ne connaît que ce
 * chemin : aucun jeton Dropbox ne descend jamais jusqu'à lui.
 *
 * La réponse est marquée immuable et cachable par le CDN : passé la première
 * demande, la vignette est servie depuis l'edge sans réveiller ni cette
 * fonction ni Dropbox. C'est ce qui rend la grille fluide à cent invités.
 */

export const runtime = "nodejs";

function isThumbnailSize(size: string): size is ThumbnailSize {
  return (THUMBNAIL_SIZES as readonly string[]).includes(size);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const size = searchParams.get("size") ?? "w640h480";
  const mode = searchParams.get("mode") === "bestfit" ? "bestfit" : "strict";

  if (!isPhotoPath(path) || !isThumbnailSize(size)) {
    return new Response("Photo introuvable.", { status: 400 });
  }

  let response = await getThumbnail(path, size, mode);
  let type = "image/jpeg";

  // Dropbox ne sait pas vignetter tous les formats (les HEIC d'iPhone, par
  // exemple) : plutôt qu'une case vide, on sert la photo d'origine.
  if (!response.ok) {
    await response.body?.cancel();
    response = await downloadPhoto(path);
    type = imageMimeType(path);
  }

  if (!response.ok) {
    console.error(`thumb ${path} → ${response.status} : ${await response.text()}`);
    return new Response("Photo introuvable.", {
      status: 404,
      headers: transientErrorHeaders(),
    });
  }

  return new Response(response.body, { headers: immutableImageHeaders(type) });
}
