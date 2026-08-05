import { MAX_ATTEMPTS, UPLOAD_CONCURRENCY } from "./config";

/**
 * Envoi d'un fichier vers Dropbox, côté navigateur.
 *
 * Deux étapes : on demande un lien à notre API, puis on POSTe le fichier
 * directement sur ce lien. Vercel ne voit passer que quelques centaines
 * d'octets de JSON, jamais les photos.
 */

/** Erreur dont il est inutile de réessayer (mauvais format, prénom manquant…) */
export class FatalUploadError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function requestUploadLink(
  guestName: string,
  file: File,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch("/api/upload-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guestName, filename: file.name, size: file.size }),
    signal,
  });

  if (!response.ok) {
    const message = await response
      .json()
      .then((data: { error?: string }) => data.error)
      .catch(() => undefined);

    // 4xx (hors 429) = la requête est mauvaise en soi, réessayer n'aidera pas
    const fatal =
      response.status >= 400 && response.status < 500 && response.status !== 429;
    const error = new Error(message ?? "Le serveur n'a pas répondu.");
    throw fatal ? new FatalUploadError(error.message) : error;
  }

  const { link } = (await response.json()) as { link: string };
  return link;
}

/**
 * POST du fichier sur le lien temporaire.
 * XMLHttpRequest plutôt que fetch : c'est le seul moyen d'avoir la
 * progression de l'envoi (`fetch` ne l'expose pas encore partout).
 */
function putFile(
  link: string,
  file: File,
  onProgress: (ratio: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", link, true);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
        return;
      }
      // 409 / 410 : lien consommé ou périmé — un nouveau lien réglera ça
      reject(new Error(`Dropbox a répondu ${xhr.status}.`));
    };

    xhr.onerror = () => reject(new Error("Connexion interrompue."));
    xhr.ontimeout = () => reject(new Error("L'envoi a mis trop de temps."));
    xhr.onabort = () => reject(new DOMException("Annulé", "AbortError"));

    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.onloadend = () => signal.removeEventListener("abort", abort);

    xhr.send(file);
  });
}

/**
 * Envoie un fichier, en redemandant un lien neuf à chaque tentative :
 * un lien expiré ou déjà consommé se répare tout seul de cette façon.
 */
export async function uploadFile(
  guestName: string,
  file: File,
  onProgress: (ratio: number) => void,
  signal: AbortSignal,
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal.aborted) throw new DOMException("Annulé", "AbortError");

    try {
      const link = await requestUploadLink(guestName, file, signal);
      await putFile(link, file, onProgress, signal);
      return;
    } catch (error) {
      if (error instanceof FatalUploadError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") throw error;

      lastError = error;
      onProgress(0);
      if (attempt < MAX_ATTEMPTS) await sleep(600 * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("L'envoi a échoué après plusieurs tentatives.");
}

/**
 * Traite `items` par petits paquets simultanés. Une salle de mariage a
 * rarement un bon réseau : trois envois de front vont plus vite que dix.
 */
export async function runPool<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency = UPLOAD_CONCURRENCY,
): Promise<void> {
  let cursor = 0;

  const next = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, next),
  );
}
