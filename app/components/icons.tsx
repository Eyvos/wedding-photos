/**
 * Jeu d'icônes de l'app — dessinées à la main, aucune dépendance.
 * Même grille 24×24 et même graisse partout : c'est ce qui leur donne
 * un air de famille.
 */

type IconProps = { className?: string };

/** Réglages communs à tous les tracés */
const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function CameraIcon({ className }: IconProps) {
  return (
    <svg {...stroke} strokeWidth={1.5} className={className}>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2a1 1 0 0 0 .83-.45l.94-1.4A1 1 0 0 1 9.3 3.7h5.4a1 1 0 0 1 .83.45l.94 1.4A1 1 0 0 0 17.3 6h1.2A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.6" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...stroke} strokeWidth={2} className={className}>
      <path d="m5 13 4.5 4.5L19 7" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...stroke} strokeWidth={2} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function LinkIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className}>
      <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1.5 1.5" />
      <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1.5-1.5" />
    </svg>
  );
}

export function QrIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M20 20v.01M20 17v.01M17 20v.01" />
    </svg>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className}>
      <path d="M12 3.5v11m0 0 4-4m-4 4-4-4" />
      <path d="M4 16v2.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V16" />
    </svg>
  );
}

/** Une pile de photos — la galerie « en vrac » */
export function ImagesIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className}>
      <rect x="7" y="3.5" width="13.5" height="13.5" rx="2.5" />
      <circle cx="11.5" cy="8" r="1.3" />
      <path d="M20.5 13.5 17 10.2l-6 6.3" />
      <path d="M16.5 20.5h-9A4 4 0 0 1 3.5 16.5v-9" />
    </svg>
  );
}

/** Deux silhouettes — la vue « par invité » */
export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className}>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3.5 20a6 6 0 0 1 12 0" />
      <path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.4a6 6 0 0 1 3 5.6" />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg {...stroke} strokeWidth={2} className={className}>
      <path d="M14.5 5 8 12l6.5 7" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...stroke} strokeWidth={2} className={className}>
      <path d="M9.5 5 16 12l-6.5 7" />
    </svg>
  );
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className}>
      <path d="M20 12H4m0 0 6.5-6.5M4 12l6.5 6.5" />
    </svg>
  );
}
