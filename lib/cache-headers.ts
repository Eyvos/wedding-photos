/**
 * En-têtes de cache des routes qui servent une image.
 *
 * Une photo est identifiée par son chemin Dropbox, et ce chemin contient
 * l'horodatage de l'envoi (Dropbox renomme les doublons) : une adresse
 * désigne donc toujours le même octet près. Tout est donc cachable « pour
 * toujours », ce qui change tout à l'échelle d'un mariage : la première
 * personne qui ouvre une vignette la fait remonter de Dropbox, les cent
 * suivantes la reçoivent du CDN en quelques millisecondes.
 *
 * Trois en-têtes, du plus général au plus précis — chaque intermédiaire lit
 * celui qui le concerne :
 *   Cache-Control            → le navigateur (et les proxies naïfs)
 *   CDN-Cache-Control        → les CDN qui suivent la RFC 9213
 *   Vercel-CDN-Cache-Control → l'edge Vercel, qui a le dernier mot
 *
 * `max-age` seul ne suffit pas : sans `s-maxage`, l'edge Vercel laisse
 * passer la requête jusqu'à la fonction, et donc jusqu'à Dropbox. C'était
 * la cause principale de la lenteur d'affichage.
 */

const YEAR = 31_536_000;

/** Une image dont le contenu ne changera jamais : cache maximal partout. */
export function immutableImageHeaders(type: string): Headers {
  return new Headers({
    "Content-Type": type,
    "Cache-Control": `public, max-age=${YEAR}, immutable`,
    "CDN-Cache-Control": `public, s-maxage=${YEAR}, immutable`,
    "Vercel-CDN-Cache-Control": `public, s-maxage=${YEAR}, immutable`,
  });
}

/**
 * Un morceau de fichier (réponse 206, demandée par un lecteur vidéo qui se
 * déplace dans la bande). Surtout pas de cache partagé : l'adresse est la
 * même pour tous les morceaux, et un CDN qui en retiendrait un le servirait
 * ensuite à qui demande le fichier entier.
 */
export function partialContentHeaders(type: string): Headers {
  return new Headers({
    "Content-Type": type,
    "Cache-Control": "private, no-store",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
  });
}

/**
 * Une réponse d'erreur ne doit pas se figer une année au bord du CDN :
 * une photo introuvable parce que Dropbox toussait doit pouvoir réapparaître.
 */
export function transientErrorHeaders(): Headers {
  return new Headers({
    "Cache-Control": "public, max-age=0, must-revalidate",
    "CDN-Cache-Control": "public, s-maxage=10",
    "Vercel-CDN-Cache-Control": "public, s-maxage=10",
  });
}

/**
 * Métadonnées de la galerie : elles bougent (un invité dépose une photo),
 * mais pas au point de justifier un aller-retour Dropbox par requête.
 * `stale-while-revalidate` sert l'ancienne liste tout de suite et rafraîchit
 * derrière — personne n'attend jamais devant un écran vide.
 */
export function galleryDataHeaders(): Headers {
  return new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=0, must-revalidate",
    "CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
    "Vercel-CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
  });
}
