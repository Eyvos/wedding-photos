/**
 * Accès Dropbox — **serveur uniquement**.
 *
 * Le refresh token et le secret de l'app ne quittent jamais cette
 * fonction serverless : le navigateur ne reçoit qu'un lien d'upload
 * temporaire, valable pour un seul fichier. Même un lien intercepté ne
 * permet ni de lire ni de supprimer quoi que ce soit dans le dossier.
 */

const TOKEN_ENDPOINT = "https://api.dropbox.com/oauth2/token";
const API_ENDPOINT = "https://api.dropboxapi.com/2";

/** Durée de validité d'un lien d'upload, en secondes (max 4h côté Dropbox) */
const UPLOAD_LINK_DURATION = 60 * 30;

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
 * Demande à Dropbox un lien d'upload à usage unique pour `path`.
 * Le navigateur y enverra ensuite le fichier en POST, sans passer par Vercel.
 */
export async function getTemporaryUploadLink(path: string): Promise<string> {
  const call = async (token: string) =>
    fetch(`${API_ENDPOINT}/files/get_temporary_upload_link`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        commit_info: {
          path,
          mode: "add",
          // Deux invités qui envoient « IMG_1234.jpg » ne s'écrasent pas :
          // Dropbox renomme le second en « IMG_1234 (1).jpg ».
          autorename: true,
          mute: true,
        },
        duration: UPLOAD_LINK_DURATION,
      }),
      cache: "no-store",
    });

  let response = await call(await getAccessToken());

  // 401 = token révoqué ou invalide côté Dropbox : on en reprend un neuf.
  if (response.status === 401) {
    invalidateToken();
    response = await call(await getAccessToken());
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Dropbox a refusé la création du lien (${response.status}) : ${detail}`,
    );
  }

  const data = (await response.json()) as { link: string };
  return data.link;
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
