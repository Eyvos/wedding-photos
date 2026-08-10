/**
 * Petits utilitaires communs aux routes qui renvoient un fichier à
 * enregistrer : une photo à l'unité ou une archive de plusieurs photos.
 */

/**
 * En-tête de pièce jointe. `filename` reste en ASCII pour les navigateurs
 * anciens, `filename*` porte la vraie graphie accentuée (RFC 5987).
 */
export function attachmentHeader(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Réponse d'erreur lisible : ces routes s'ouvrent dans l'onglet du visiteur. */
export function downloadError(message: string, status = 400): Response {
  const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Téléchargement impossible</title>
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:#faf6ee; color:#3a2e23; font-family:system-ui, sans-serif;
         text-align:center; padding:2rem; }
  p { max-width:32rem; line-height:1.6; }
  a { color:#8a6a45; }
</style></head><body><div>
  <h1 style="font-weight:400">Téléchargement impossible</h1>
  <p>${escapeHtml(message)}</p>
  <p><a href="/photos">Revenir aux photos</a></p>
</div></body></html>`;

  return new Response(page, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
