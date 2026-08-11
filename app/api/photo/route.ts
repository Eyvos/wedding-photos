import {
  immutableImageHeaders,
  partialContentHeaders,
  transientErrorHeaders,
} from "@/lib/cache-headers";
import { isVideoFile, mediaMimeType } from "@/lib/config";
import { attachmentHeader } from "@/lib/download";
import { downloadPhoto, getTemporaryLink, isMediaPath } from "@/lib/dropbox";
import { mediaDisplayName } from "@/lib/gallery";

/**
 * GET /api/photo?path=… — le fichier d'origine, pleine résolution.
 *
 * Deux usages, le même octet :
 *   par défaut          → pièce jointe, le navigateur l'enregistre sous son
 *                         vrai nom (bouton « Télécharger »)
 *   &inline=1           → servi tel quel, pour être lu dans la page — c'est
 *                         ainsi que la balise <video> du plein écran s'alimente
 *
 * L'en-tête `Range` du navigateur est relayé à Dropbox et sa réponse rendue
 * telle quelle. Sans cela, se déplacer dans une vidéo obligerait à la
 * télécharger jusqu'au point visé : le lecteur resterait figé sur place.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const inline = searchParams.get("inline") === "1";

  if (!isMediaPath(path)) {
    return new Response("Fichier introuvable.", { status: 400 });
  }

  // Une vidéo qu'on regarde part directement de Dropbox : le lecteur y
  // demandera ses morceaux sans repasser par nous. Le téléchargement, lui,
  // reste relayé — c'est ce qui lui garde son vrai nom de fichier.
  if (inline && isVideoFile(path)) {
    const link = await getTemporaryLink(path).catch((error: unknown) => {
      console.error(`lien de lecture ${path} —`, error);
      return null;
    });

    // Le lien périme en 4 h : le mettre en cache le ferait survivre à sa
    // propre validité. Un échec, lui, se rattrape par le relais ci-dessous.
    if (link) {
      return new Response(null, {
        status: 302,
        headers: { Location: link, "Cache-Control": "private, no-store" },
      });
    }
  }

  const range = request.headers.get("Range") ?? undefined;
  const response = await downloadPhoto(path, range);

  // 200 (tout le fichier) et 206 (le morceau demandé) sont deux succès
  if (!response.ok && response.status !== 206) {
    console.error(`photo ${path} → ${response.status} : ${await response.text()}`);
    return new Response("Fichier introuvable.", {
      status: 404,
      headers: transientErrorHeaders(),
    });
  }

  const filename = mediaDisplayName(path.slice(path.lastIndexOf("/") + 1));
  const type = mediaMimeType(path);
  const headers =
    response.status === 206
      ? partialContentHeaders(type)
      : immutableImageHeaders(type);

  if (!inline) headers.set("Content-Disposition", attachmentHeader(filename));

  // Annoncé sur toutes les réponses : c'est ce qui dit au lecteur vidéo qu'il
  // peut demander un morceau plutôt que de tout tirer depuis le début.
  headers.set("Accept-Ranges", "bytes");

  for (const name of ["Content-Length", "Content-Range"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(response.body, { status: response.status, headers });
}
