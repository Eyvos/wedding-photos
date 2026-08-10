"use client";

import { CheckIcon } from "./icons";

/**
 * La pastille de sélection posée sur une vignette ou une carte d'invité.
 * Assez grande pour être touchée du pouce sans ouvrir la photo par erreur.
 *
 * Deux fonds possibles, d'où la variante : posée sur une photo, la pastille
 * s'éclaircit et se floute pour rester lisible quoi qu'il y ait dessous ;
 * posée sur une carte crème, il lui faut au contraire un fond plus soutenu
 * que la carte pour ne pas s'y fondre.
 *
 * Au survol, la pastille prend franchement la couleur d'accent et laisse
 * apparaître sa coche : c'est ce qui dit « cochable » avant même le clic.
 */

type Props = {
  checked: boolean;
  onChange: () => void;
  /** Libellé lu par les lecteurs d'écran */
  label: string;
  /** Sur quoi la pastille est posée : une photo, ou une carte claire */
  variant?: "photo" | "card";
  className?: string;
};

/** Le repos, quand rien n'est coché — tout le reste est commun aux variantes. */
const IDLE = {
  photo: "border-base-100/70 bg-base-100/55 backdrop-blur-sm",
  card: "border-base-300 bg-base-200",
} as const;

export default function SelectMark({
  checked,
  onChange,
  label,
  variant = "photo",
  className = "",
}: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={onChange}
      className={`flex size-8 cursor-pointer items-center justify-center rounded-full border transition-colors ${
        checked
          ? "border-accent bg-accent text-accent-content hover:border-accent/70 hover:bg-accent/70"
          : `text-transparent hover:border-accent hover:bg-accent/20 hover:text-accent ${IDLE[variant]}`
      } ${className}`}
    >
      <CheckIcon className="size-4" />
    </button>
  );
}
