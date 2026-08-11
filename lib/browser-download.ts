/**
 * Déclenchement d'un téléchargement d'archive depuis le navigateur.
 *
 * On passe par un vrai formulaire plutôt que par `fetch` : le navigateur
 * écrit alors le ZIP sur le disque au fur et à mesure qu'il arrive, avec sa
 * barre de progression, sans jamais garder 200 Mo en mémoire. La réponse
 * étant une pièce jointe, la page affichée ne bouge pas.
 *
 * Avant d'envoyer quoi que ce soit, on demande le plan. Rien à arbitrer avec
 * sa réponse — l'archive part entière de toute façon —, mais elle vient d'un
 * appel ordinaire, donc une demande vide ou un album injoignable se disent
 * dans la page. Le formulaire, lui, n'a que la navigation pour le dire : il
 * remplacerait la galerie par une page d'erreur.
 */

import type { ArchivePlan, ArchiveRequest } from "./archive";
import type { PhotoCard } from "./gallery";

export type { ArchiveRequest } from "./archive";

/** Les champs de formulaire qui décrivent `request`, côté serveur. */
function fieldsOf(request: ArchiveRequest): Record<string, string> {
  const fields: Record<string, string> = { scope: request.scope };

  if (request.scope === "guests") fields.guests = JSON.stringify(request.guests);
  if (request.scope === "photos") fields.paths = JSON.stringify(request.paths);

  return fields;
}

/** Demande au serveur ce que pèse `request` et en combien de parties. */
export async function fetchArchivePlan(
  request: ArchiveRequest,
  signal?: AbortSignal,
): Promise<ArchivePlan> {
  const body = new FormData();
  for (const [name, value] of Object.entries(fieldsOf(request))) {
    body.append(name, value);
  }

  const response = await fetch("/api/download/plan", {
    method: "POST",
    body,
    signal,
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(detail?.error ?? "Le téléchargement n'a pas pu être préparé.");
  }

  return (await response.json()) as ArchivePlan;
}

/** Envoie la demande et laisse le navigateur enregistrer le fichier. */
export function startArchiveDownload(request: ArchiveRequest): void {
  const fields = fieldsOf(request);

  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/download";
  form.hidden = true;

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.append(input);
  }

  document.body.append(form);
  form.submit();
  form.remove();
}

/** Adresse d'une vignette servie par notre API. */
export function thumbUrl(
  photo: PhotoCard,
  size: "w256h256" | "w640h480" | "w1024h768",
  mode: "strict" | "bestfit" = "strict",
): string {
  const params = new URLSearchParams({ path: photo.path, size, mode });
  return `/api/thumb?${params}`;
}

/** Adresse de la photo d'origine, en pièce jointe. */
export function photoDownloadUrl(photo: PhotoCard): string {
  return `/api/photo?${new URLSearchParams({ path: photo.path })}`;
}

/**
 * Adresse du fichier d'origine servi tel quel, à lire dans la page — c'est
 * la source de la balise <video>. Même route que le téléchargement, sans la
 * pièce jointe : autrement le navigateur enregistrerait le film au lieu de
 * le jouer.
 */
export function mediaStreamUrl(photo: PhotoCard): string {
  const params = new URLSearchParams({ path: photo.path, inline: "1" });
  return `/api/photo?${params}`;
}
