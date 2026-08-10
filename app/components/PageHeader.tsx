import Link from "next/link";
import type { Route } from "next";

import { ArrowLeftIcon } from "./icons";

/**
 * En-tête des pages internes : un chemin de retour toujours visible, puis
 * le titre. L'accueil garde son grand bandeau ; ici, on va à l'essentiel.
 */

type Props = {
  backHref: Route;
  backLabel: string;
  title: string;
  subtitle?: string;
};

export default function PageHeader({
  backHref,
  backLabel,
  title,
  subtitle,
}: Props) {
  return (
    <header className="mb-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-base-content/60 transition-colors hover:text-primary"
      >
        <ArrowLeftIcon className="size-4" />
        {backLabel}
      </Link>

      <h1 className="mt-4 font-display text-4xl font-light leading-tight sm:text-5xl">
        {title}
      </h1>

      {subtitle && (
        <p className="mt-2 text-pretty text-base-content/65">{subtitle}</p>
      )}

      <div className="rule mt-5 w-32" />
    </header>
  );
}
