/**
 * Accès Dropbox — **serveur uniquement**.
 *
 * Le refresh token et le secret de l'app ne quittent jamais cette
 * fonction serverless : le navigateur ne reçoit qu'un lien d'upload
 * temporaire, valable pour un seul fichier. Même un lien intercepté ne
 * permet ni de lire ni de supprimer quoi que ce soit dans le dossier.
 *
 * Pour la consultation, les photos transitent par nos routes API : le
 * navigateur ne voit jamais de jeton Dropbox, et aucune fonction de
 * suppression n'est exposée — ce module n'en contient tout simplement pas.
 */

import { isAllowedFile, isVideoFile } from "./config";
import {
  mediaDisplayName,
  slugify,
  UNKNOWN_GUEST,
  type Guest,
  type Photo,
} from "./gallery";

const TOKEN_ENDPOINT = "https://api.dropbox.com/oauth2/token";
const API_ENDPOINT = "https://api.dropboxapi.com/2";
const CONTENT_ENDPOINT = "https://content.dropboxapi.com/2";

/** Durée de validité d'un lien d'upload, en secondes (max 4h côté Dropbox) */
const UPLOAD_LINK_DURATION = 60 * 30;

/**
 * Durée de vie du catalogue en mémoire. Assez court pour qu'une photo
 * déposée pendant qu'on regarde la galerie apparaisse vite, assez long pour
 * ne pas relister l'album à chaque vignette demandée.
 */
const LISTING_TTL = 30_000;

/**
 * Passé le TTL, on continue à servir la liste connue pendant qu'une autre
 * va la rafraîchir : sur un album de plusieurs milliers de photos, le
 * listing Dropbox prend plusieurs secondes, et personne n'a à les attendre.
 * Au-delà de cette limite, en revanche, la liste est trop vieille pour être
 * montrée : on attend le rafraîchissement.
 */
const LISTING_MAX_AGE = 10 * 60_000;

type CachedToken = { accessToken: string; expiresAt: number };

/**
 * Les instances serverless sont réutilisées entre deux requêtes : garder
 * l'access token en mémoire évite un aller-retour OAuth par photo.
 */
let cachedToken: CachedToken | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Voir SETUP.md.`,
    );
  }
  return value;
}

/**
 * Échange le refresh token contre un access token de courte durée.
 * Les refresh tokens Dropbox n'expirent pas : rien à renouveler à la main.
 */
async function getAccessToken(): Promise<string> {
  // 60 s de marge pour ne pas utiliser un token qui expire en vol
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const appKey = requireEnv("DROPBOX_APP_KEY");
  const appSecret = requireEnv("DROPBOX_APP_SECRET");
  const refreshToken = requireEnv("DROPBOX_REFRESH_TOKEN");

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Rafraîchissement du token Dropbox refusé (${response.status}) : ${detail}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.accessToken;
}

/** Le token en cache est peut-être révoqué : forcer un nouvel échange. */
function invalidateToken() {
  cachedToken = null;
}

/**
 * Joue `call` avec un access token, et une seconde fois avec un token neuf
 * si Dropbox répond 401 — c'est le signe que celui en cache a été révoqué.
 */
async function withToken(
  call: (token: string) => Promise<Response>,
): Promise<Response> {
  const response = await call(await getAccessToken());
  if (response.status !== 401) return response;

  invalidateToken();
  return call(await getAccessToken());
}

/** Appel RPC classique : arguments et réponse en JSON. */
async function rpc<T>(endpoint: string, args: unknown): Promise<T> {
  const response = await withToken((token) =>
    fetch(`${API_ENDPOINT}/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    }),
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Dropbox ${endpoint} → ${response.status} : ${detail}`);
  }

  return (await response.json()) as T;
}

/**
 * Appel « content » : les arguments passent par un en-tête, la réponse est
 * le fichier lui-même. On rend la `Response` telle quelle pour que la route
 * qui appelle puisse relayer le flux sans jamais tout charger en mémoire.
 */
function contentCall(
  endpoint: string,
  args: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  return withToken((token) =>
    fetch(`${CONTENT_ENDPOINT}/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": encodeApiArg(args),
        ...extraHeaders,
      },
      cache: "no-store",
    }),
  );
}

/**
 * L'en-tête `Dropbox-API-Arg` n'accepte que de l'ASCII : les accents des
 * prénoms doivent partir en séquences d'échappement JSON.
 */
function encodeApiArg(args: unknown): string {
  return JSON.stringify(args).replace(/[-￿]/g, (char) => {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}

/**
 * Demande à Dropbox un lien d'upload à usage unique pour `path`.
 * Le navigateur y enverra ensuite le fichier en POST, sans passer par Vercel.
 */
export async function getTemporaryUploadLink(path: string): Promise<string> {
  const { link } = await rpc<{ link: string }>(
    "files/get_temporary_upload_link",
    {
      commit_info: {
        path,
        mode: "add",
        // Deux invités qui envoient « IMG_1234.jpg » ne s'écrasent pas :
        // Dropbox renomme le second en « IMG_1234 (1).jpg ».
        autorename: true,
        mute: true,
      },
      duration: UPLOAD_LINK_DURATION,
    },
  );

  return link;
}

/* -------------------------------------------------------------------------- */
/* Consultation : lister, prévisualiser, télécharger. Jamais supprimer.       */
/* -------------------------------------------------------------------------- */

type DropboxEntry = {
  ".tag": "file" | "folder" | "deleted";
  name: string;
  path_lower: string;
  path_display: string;
  size?: number;
  server_modified?: string;
};

type ListFolderResult = {
  entries: DropboxEntry[];
  cursor: string;
  has_more: boolean;
};

let cachedListing: { at: number; guests: Guest[] } | null = null;
/** Deux visiteurs simultanés ne doivent pas déclencher deux listings */
let pendingListing: Promise<Guest[]> | null = null;

/**
 * Le catalogue complet de l'album, groupé par invité.
 * Les mariés ne rangent rien à la main : ce que Dropbox contient fait foi.
 */
export async function listGuests(): Promise<Guest[]> {
  const known = cachedListing;
  if (known && known.at > Date.now() - LISTING_TTL) return known.guests;

  if (!pendingListing) {
    pendingListing = fetchGuests()
      .then((guests) => {
        cachedListing = { at: Date.now(), guests };
        return guests;
      })
      .finally(() => {
        pendingListing = null;
      });
    // Un rafraîchissement de fond qui échoue ne doit pas remonter jusqu'au
    // visiteur à qui l'on vient de servir la liste précédente.
    pendingListing.catch(() => {});
  }

  // Liste un peu datée mais encore présentable : on la rend tout de suite et
  // le rafraîchissement lancé ci-dessus profitera au visiteur suivant.
  if (known && known.at > Date.now() - LISTING_MAX_AGE) return known.guests;

  return pendingListing;
}

async function fetchGuests(): Promise<Guest[]> {
  let page = await rpc<ListFolderResult>("files/list_folder", {
    path: "",
    recursive: true,
    limit: 2000,
  });

  const entries = [...page.entries];
  while (page.has_more) {
    page = await rpc<ListFolderResult>("files/list_folder/continue", {
      cursor: page.cursor,
    });
    entries.push(...page.entries);
  }

  return groupByGuest(entries);
}

function groupByGuest(entries: DropboxEntry[]): Guest[] {
  const byName = new Map<string, Photo[]>();

  for (const entry of entries) {
    if (entry[".tag"] !== "file") continue;
    // Un fichier étranger déposé à la main dans Dropbox n'a rien à faire ici
    if (!isAllowedFile(entry.name)) continue;

    // « /Élodie/2026-…_IMG_1.jpg » → l'invité est le premier segment.
    const segments = entry.path_display.split("/").filter(Boolean);
    const guest = segments.length > 1 ? segments[0] : UNKNOWN_GUEST;

    const photos = byName.get(guest) ?? [];
    photos.push({
      path: entry.path_display,
      name: mediaDisplayName(entry.name),
      guest,
      size: entry.size ?? 0,
      uploadedAt: entry.server_modified ?? "",
    });
    byName.set(guest, photos);
  }

  const used = new Set<string>();

  return [...byName.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([name, photos]) => {
      // Deux prénoms différents peuvent donner la même URL (« Léa » / « Lea ») :
      // on suffixe pour que chaque invité garde une page bien à lui.
      let slug = slugify(name);
      for (let n = 2; used.has(slug); n++) slug = `${slugify(name)}-${n}`;
      used.add(slug);

      photos.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));

      return {
        name,
        slug,
        photos,
        videos: photos.filter((photo) => isVideoFile(photo.path)).length,
        size: photos.reduce((sum, photo) => sum + photo.size, 0),
      };
    });
}

/** Formats de vignette autorisés côté Dropbox, du plus léger au plus lourd */
export const THUMBNAIL_SIZES = [
  "w256h256",
  "w640h480",
  "w1024h768",
  "w2048h1536",
] as const;

export type ThumbnailSize = (typeof THUMBNAIL_SIZES)[number];

/**
 * Vignette JPEG générée par Dropbox. `strict` recadre au format demandé pour
 * la grille ; `bestfit` conserve les proportions pour l'affichage plein écran.
 *
 * Ne vaut que pour les images : Dropbox ne vignette pas les vidéos, et une
 * demande sur un .mp4 revient en erreur. C'est à l'appelant de ne pas la
 * poser — voir `api/thumb`.
 */
export function getThumbnail(
  path: string,
  size: ThumbnailSize,
  mode: "strict" | "bestfit",
): Promise<Response> {
  return contentCall("files/get_thumbnail_v2", {
    resource: { ".tag": "path", path },
    format: "jpeg",
    size,
    mode,
  });
}

/**
 * Lien de lecture directe vers un fichier, valable 4 h côté Dropbox.
 *
 * Sert aux vidéos, et à elles seules. Une vidéo relayée par nos fonctions
 * s'y retire octet par octet à chaque fois qu'on la regarde ou qu'on s'y
 * déplace : le lecteur demande des morceaux (`Range`), et un morceau ne se
 * met pas en cache au bord du CDN sous la même adresse que le fichier
 * entier. Renvoyer le navigateur vers Dropbox lui fait parler directement au
 * CDN qui héberge déjà le fichier — plus rien ne transite par Vercel.
 *
 * Le lien ne donne accès qu'à ce seul fichier, en lecture, et périme : la
 * même posture que les liens d'envoi, déjà confiés au navigateur.
 */
export async function getTemporaryLink(path: string): Promise<string> {
  const { link } = await rpc<{ link: string }>("files/get_temporary_link", {
    path,
  });

  return link;
}

/**
 * Le fichier d'origine, pleine résolution — pour le téléchargement.
 *
 * `range` relaie tel quel l'en-tête `Range` du navigateur : c'est ce qui
 * permet de se déplacer dans une vidéo sans en avoir téléchargé la fin. La
 * réponse est rendue telle quelle, 206 comprise, à charge pour la route de
 * la répercuter.
 */
export function downloadPhoto(path: string, range?: string): Promise<Response> {
  return contentCall("files/download", { path }, range ? { Range: range } : {});
}

/**
 * Un chemin venu du navigateur ne doit pouvoir désigner qu'un souvenir de
 * l'album. L'app Dropbox est déjà confinée à son propre dossier ; ce filtre
 * ferme la porte aux chemins bricolés avant même de contacter Dropbox.
 */
export function isMediaPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    path.length < 512 &&
    !path.includes("..") &&
    !path.includes("//") &&
    !/[\x00-\x1f\x7f]/.test(path) &&
    isAllowedFile(path)
  );
}

/** Caractères interdits dans un chemin Dropbox, plus les caractères de contrôle. */
const ILLEGAL_PATH_CHARS = /[\x00-\x1f\x7f\\/:*?"<>|]/g;

/**
 * Rend une chaîne utilisable comme segment de chemin Dropbox.
 * Retourne `fallback` si, une fois nettoyée, il ne reste rien d'exploitable.
 */
export function sanitizePathSegment(input: string, fallback: string): string {
  const cleaned = input
    .normalize("NFC")
    .replace(ILLEGAL_PATH_CHARS, " ")
    .replace(/\s+/g, " ")
    // Dropbox rejette les segments terminés par un point ou une espace
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, 60);

  return cleaned.length > 0 ? cleaned : fallback;
}
