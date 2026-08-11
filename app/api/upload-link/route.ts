import { NextResponse } from "next/server";

import {
  MAX_FILE_SIZE,
  MAX_NAME_LENGTH,
  fileExtension,
  isAllowedFile,
  WEDDING,
} from "@/lib/config";
import { getTemporaryUploadLink, sanitizePathSegment } from "@/lib/dropbox";

/**
 * POST /api/upload-link
 *
 * Reçoit { guestName, filename, size } et renvoie { link, path } : une URL
 * Dropbox à usage unique vers laquelle le navigateur enverra le fichier.
 * Les octets ne transitent jamais par Vercel — pas de limite de taille de
 * requête serverless, et le token Dropbox reste côté serveur.
 */

export const runtime = "nodejs";
// Chaque appel doit produire un lien frais : rien à mettre en cache.
export const dynamic = "force-dynamic";

type Body = {
  guestName?: unknown;
  filename?: unknown;
  size?: unknown;
};

/**
 * Garde-fou anti-abus, au mieux de ce que permet le serverless : le compteur
 * vit dans l'instance et disparaît avec elle. Suffisant pour freiner un script
 * qui bombarderait l'endpoint, sans gêner un invité qui envoie 60 photos.
 */
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 120;
const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    // Purge opportuniste : évite que la Map grossisse indéfiniment
    if (hits.size > 500) {
      for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    }
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnu";

  if (isRateLimited(ip)) {
    return bad("Trop de demandes d'un coup. Réessaie dans une minute.", 429);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Requête illisible.");
  }

  const { guestName, filename, size } = body;

  if (typeof filename !== "string" || filename.length === 0) {
    return bad("Nom de fichier manquant.");
  }

  if (!isAllowedFile(filename)) {
    return bad(
      "Ce format de fichier n'est pas accepté (photos et vidéos uniquement).",
    );
  }

  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return bad("Taille de fichier invalide.");
  }

  if (size > MAX_FILE_SIZE) {
    return bad("Ce fichier dépasse 150 Mo.", 413);
  }

  if (typeof guestName !== "string" || guestName.trim().length === 0) {
    return bad("Merci d'indiquer ton prénom.");
  }

  if (guestName.trim().length > MAX_NAME_LENGTH) {
    return bad(`Prénom trop long (${MAX_NAME_LENGTH} caractères maximum).`);
  }

  // Un dossier par invité, pour que les mariés voient tout de suite qui a
  // envoyé quoi. Le préfixe horodaté garde l'ordre chronologique lisible.
  const folder = sanitizePathSegment(guestName.trim(), "Invité");
  const extension = fileExtension(filename);
  const base = sanitizePathSegment(
    filename.slice(0, filename.length - extension.length - 1),
    "photo",
  );
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `/${folder}/${stamp}_${base}.${extension}`;

  try {
    const link = await getTemporaryUploadLink(path);
    return NextResponse.json({ link, path });
  } catch (error) {
    // Le détail (token, réponse Dropbox) reste dans les logs Vercel.
    console.error(`[${WEDDING.dateISO}] upload-link a échoué :`, error);
    return bad(
      "Impossible de préparer l'envoi pour l'instant. Réessaie dans un instant.",
      502,
    );
  }
}
