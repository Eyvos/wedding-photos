"use client";

import { useEffect } from "react";

import type { ArchiveDownload } from "./useArchiveDownload";
import { CloseIcon } from "./icons";

/**
 * Ce qui s'affiche quand un téléchargement ne peut pas partir : album
 * injoignable, sélection vide. Le fichier, lui, s'enregistre tout seul —
 * il n'y a rien à annoncer quand tout va bien.
 */

type Props = { download: ArchiveDownload };

export default function ArchiveDialog({ download }: Props) {
  const { error, dismiss } = download;

  // Échap referme, comme partout ailleurs
  useEffect(() => {
    if (!error) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [error, dismiss]);

  if (!error) return null;

  return (
    <Shell onClose={dismiss} title="Téléchargement impossible">
      <p className="text-pretty text-base-content/70">{error}</p>
      <button
        type="button"
        className="btn btn-primary mt-6 w-full"
        onClick={dismiss}
      >
        Fermer
      </button>
    </Shell>
  );
}

function Shell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-box border border-base-300 bg-base-200 p-5 shadow-xl sm:rounded-box sm:p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl font-medium leading-tight">
            {title}
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle shrink-0"
            onClick={onClose}
            aria-label="Fermer"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
