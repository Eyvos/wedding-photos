import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import ShareActions from "./components/ShareActions";
import WeddingHeader from "./components/WeddingHeader";
import { CameraIcon, ImagesIcon } from "./components/icons";

/**
 * L'accueil pose la question et s'efface : on vient soit déposer ses
 * photos, soit voir celles des autres. Le partage du lien est ici, à la
 * racine — c'est cette page-là qu'on fait circuler.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-10 sm:py-16">
      <WeddingHeader />
      <ShareActions />

      <nav className="mt-10 grid gap-4">
        <ChoiceCard
          href="/depot"
          icon={<CameraIcon className="size-7" />}
          title="Déposer des souvenirs"
          description="Envoyer les photos et les vidéos que tu as prises pendant la journée."
        />
        <ChoiceCard
          href="/photos"
          icon={<ImagesIcon className="size-7" />}
          title="Voir et récupérer les photos"
          description="Parcourir l'album, choisir tes préférées et les télécharger."
        />
      </nav>

      <footer className="mt-14 space-y-3 text-center text-sm text-base-content/50">
        <div className="rule mx-auto w-24" />
        <p>
          L&apos;album vit dans l&apos;espace privé des mariés. Seules les
          personnes qui ont ce lien peuvent y déposer et y regarder des photos.
        </p>
      </footer>
    </main>
  );
}

function ChoiceCard({
  href,
  icon,
  title,
  description,
}: {
  href: Route;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-box border border-base-300 bg-base-100/80 p-5 backdrop-blur transition-colors hover:border-primary/60 hover:bg-base-100"
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary transition-colors group-hover:bg-primary/20">
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block font-display text-2xl font-medium">{title}</span>
        <span className="mt-0.5 block text-pretty text-sm text-base-content/60">
          {description}
        </span>
      </span>
    </Link>
  );
}
