import UploadZone from "./components/UploadZone";
import { WEDDING } from "@/lib/config";

export default function Home() {
  const [one, two] = WEDDING.brideAndGroom;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-10 sm:py-16">
      <header className="mb-10 text-center">
        <p className="font-display text-sm uppercase tracking-[0.35em] text-base-content/50">
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

        <p className="mx-auto mt-8 max-w-md text-pretty text-base-content/70">
          Tu as pris des photos&nbsp;? Dépose-les ici.
        </p>
      </header>

      <UploadZone />

      <footer className="mt-14 space-y-3 text-center text-sm text-base-content/50">
        <div className="rule mx-auto w-24" />
        <p>
          Les photos vont directement dans l&apos;album privé des mariés.
          Personne d&apos;autre n&apos;y a accès.
        </p>
      </footer>
    </main>
  );
}
