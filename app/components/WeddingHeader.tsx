import { WEDDING } from "@/lib/config";

/** Le bandeau d'accueil : les prénoms, la date, et rien d'autre. */
export default function WeddingHeader() {
  const [one, two] = WEDDING.brideAndGroom;

  return (
    <header className="text-center">
      {/* Interlettrage resserré sur mobile : à cette taille, 0.35em ferait
          passer « DE » à la ligne sur un écran de 375 px */}
      <p className="font-display text-base uppercase tracking-[0.28em] text-base-content/50 sm:text-lg sm:tracking-[0.35em]">
        Les photos du mariage de
      </p>

      <h1 className="mt-4 font-display text-6xl font-light leading-none sm:text-7xl">
        {one}
        <span className="mx-3 text-primary">&amp;</span>
        {two}
      </h1>

      <div className="rule mx-auto my-6 w-40" />

      <time
        dateTime={WEDDING.dateISO}
        className="font-display text-3xl tracking-wide text-base-content/75 sm:text-4xl"
      >
        {WEDDING.dateLabel}
      </time>
    </header>
  );
}
