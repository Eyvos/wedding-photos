import type { Metadata } from "next";

import PageHeader from "../components/PageHeader";
import UploadZone from "../components/UploadZone";

export const metadata: Metadata = { title: "Déposer des photos" };

export default function DepotPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-8 sm:py-12">
      <PageHeader
        backHref="/"
        backLabel="Accueil"
        title="Déposer des photos"
        subtitle="Ton prénom, tes photos, et c'est parti. Rien à installer."
      />

      <UploadZone />

      <footer className="mt-14 space-y-3 text-center text-sm text-base-content/50">
        <div className="rule mx-auto w-24" />
        <p>
          Les photos rejoignent l&apos;album des mariés. Une fois déposées,
          elles restent : personne ne peut en supprimer.
        </p>
      </footer>
    </main>
  );
}
