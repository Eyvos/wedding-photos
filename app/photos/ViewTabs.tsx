import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import { ImagesIcon, UsersIcon } from "../components/icons";

/**
 * Les deux façons de parcourir l'album : tout en vrac, ou rangé par
 * invité. L'onglet actif est dans l'URL, donc le retour arrière du
 * téléphone ramène bien là d'où l'on vient.
 */
export default function ViewTabs({ byGuest }: { byGuest: boolean }) {
  return (
    <nav className="mb-6 flex gap-1 rounded-box border border-base-300 bg-base-100/70 p-1 backdrop-blur">
      <Tab href="/photos" active={!byGuest} icon={<ImagesIcon className="size-4" />}>
        Toutes les photos
      </Tab>
      <Tab
        href="/photos?vue=invites"
        active={byGuest}
        icon={<UsersIcon className="size-4" />}
      >
        Par invité
      </Tab>
    </nav>
  );
}

function Tab({
  href,
  active,
  icon,
  children,
}: {
  href: Route;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-field px-3 py-2 text-xs transition-colors sm:text-sm ${
        active
          ? "bg-primary text-primary-content"
          : "text-base-content/70 hover:bg-base-200"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
