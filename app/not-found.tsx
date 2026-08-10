import Link from "next/link";

/** Une page inconnue reste dans le décor du site plutôt que dans celui du serveur. */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16 text-center">
      <p className="font-display text-6xl font-light text-primary">404</p>

      <h1 className="mt-4 font-display text-3xl font-medium">
        Cette page n&apos;existe pas
      </h1>
      <p className="mt-3 text-base-content/65">
        Le lien est peut-être incomplet, ou la page a changé d&apos;adresse.
      </p>

      <div className="rule mx-auto my-8 w-32" />

      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn btn-primary">
          Retour à l&apos;accueil
        </Link>
        <Link href="/photos" className="btn btn-ghost">
          Voir les photos
        </Link>
      </div>
    </main>
  );
}
