/**
 * L'ossature d'une page de galerie pendant que l'album se charge.
 *
 * Lister un Dropbox de plusieurs milliers de photos prend quelques secondes.
 * Sans rien à l'écran, ces secondes-là ressemblent à une panne ; avec la
 * page déjà dessinée en creux, elles ressemblent à ce qu'elles sont. Les
 * proportions reprennent celles de la vraie page, pour que le contenu se
 * pose dessus sans faire sauter la mise en page.
 */

type Props = {
  /** Réserve la place des deux onglets de la page d'ensemble */
  withTabs?: boolean;
  /** Nombre de cases de la grille */
  count?: number;
};

export default function GallerySkeleton({ withTabs, count = 12 }: Props) {
  return (
    <main
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:py-12"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Chargement de l&apos;album…</span>

      <header className="mb-8" aria-hidden>
        <div className="skeleton h-4 w-24 rounded-field" />
        <div className="skeleton mt-4 h-11 w-3/4 rounded-field sm:h-12" />
        <div className="skeleton mt-3 h-4 w-52 rounded-field" />
        <div className="rule mt-5 w-32" />
      </header>

      {withTabs && (
        <div
          className="mb-6 flex gap-1 rounded-box border border-base-300 bg-base-100/70 p-1"
          aria-hidden
        >
          <div className="skeleton h-9 flex-1 rounded-field" />
          <div className="skeleton h-9 flex-1 rounded-field" />
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3" aria-hidden>
        <div className="skeleton h-4 w-32 rounded-field" />
        <div className="skeleton h-8 w-36 rounded-field" />
      </div>

      <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2" aria-hidden>
        {Array.from({ length: count }).map((_, index) => (
          <li key={index}>
            <div className="skeleton aspect-square w-full rounded-field" />
          </li>
        ))}
      </ul>
    </main>
  );
}
