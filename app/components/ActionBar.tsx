"use client";

import { DownloadIcon } from "./icons";

/**
 * Barre d'action de la sélection : elle se colle en bas de l'écran dès
 * qu'une case est cochée, à portée de pouce, et disparaît sinon.
 */

type Props = {
  summary: string;
  /** Le serveur prépare l'archive : le clic a été pris en compte */
  pending: boolean;
  onClear: () => void;
  onDownload: () => void;
};

export default function ActionBar({
  summary,
  pending,
  onClear,
  onDownload,
}: Props) {
  return (
    <div className="sticky bottom-4 z-10 mt-6">
      <div className="flex items-center justify-between gap-3 rounded-box border border-base-300 bg-base-100/95 py-2.5 pl-4 pr-2.5 shadow-lg backdrop-blur">
        {/* Le résumé et son annulation tiennent en colonne : sur un écran de
            375 px, le bouton de téléchargement garde ainsi toute sa place. */}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{summary}</p>
          <button
            type="button"
            className="text-xs text-base-content/55 underline-offset-2 hover:underline"
            onClick={onClear}
          >
            Tout décocher
          </button>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm shrink-0"
          onClick={onDownload}
          disabled={pending}
        >
          {pending ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              Préparation…
            </>
          ) : (
            <>
              <DownloadIcon className="size-4" />
              Télécharger
            </>
          )}
        </button>
      </div>
    </div>
  );
}
