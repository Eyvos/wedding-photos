/**
 * L'album est injoignable — Dropbox en panne, quota atteint, autorisation
 * révoquée. Le détail part dans les logs ; l'invité, lui, n'a besoin que
 * de savoir que ça ne vient pas de lui.
 */
export default function GalleryError() {
  return (
    <div className="rounded-box border border-base-300 bg-base-100/80 px-6 py-14 text-center backdrop-blur">
      <p className="font-display text-2xl font-medium">
        L&apos;album ne répond pas
      </p>
      <p className="mx-auto mt-3 max-w-md text-pretty text-base-content/65">
        Impossible d&apos;aller chercher les photos pour le moment. Rien
        n&apos;est perdu — réessaie dans quelques instants.
      </p>
    </div>
  );
}
