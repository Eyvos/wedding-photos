import { immutableImageHeaders, transientErrorHeaders } from "@/lib/cache-headers";
import { imageMimeType } from "@/lib/config";
import { attachmentHeader } from "@/lib/download";
import { downloadPhoto, isPhotoPath } from "@/lib/dropbox";
import { photoDisplayName } from "@/lib/gallery";

/**
 * GET /api/photo?path=… — la photo d'origine, pleine résolution.
 *
 * Sert au téléchargement d'une photo à l'unité : le navigateur reçoit un
 * `Content-Disposition` en pièce jointe et l'enregistre sous son vrai nom.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!isPhotoPath(path)) {
    return new Response("Photo introuvable.", { status: 400 });
  }

  const response = await downloadPhoto(path);

  if (!response.ok) {
    console.error(`photo ${path} → ${response.status} : ${await response.text()}`);
    return new Response("Photo introuvable.", {
      status: 404,
      headers: transientErrorHeaders(),
    });
  }

  const filename = photoDisplayName(path.slice(path.lastIndexOf("/") + 1));
  const headers = immutableImageHeaders(imageMimeType(path));
  headers.set("Content-Disposition", attachmentHeader(filename));

  const length = response.headers.get("Content-Length");
  if (length) headers.set("Content-Length", length);

  return new Response(response.body, { headers });
}
