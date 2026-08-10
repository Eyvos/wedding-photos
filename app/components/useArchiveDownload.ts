"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ArchiveRequest } from "@/lib/archive";
import { fetchArchivePlan, startArchiveDownload } from "@/lib/browser-download";

/**
 * L'état d'un téléchargement d'archive, du clic jusqu'au fichier.
 *
 * Préparer une archive demande au serveur de lister l'album : quelques
 * secondes pendant lesquelles il ne se passe visiblement rien. D'où
 * `pending` : le bouton dit qu'il travaille au lieu de laisser croire au clic
 * perdu. Ce même aller-retour sert de garde-fou — si l'album est injoignable,
 * on le dit dans la page plutôt que d'ouvrir un fichier qui n'arrivera pas.
 */

export type ArchiveDownload = {
  /** Préparation en cours : le serveur compte les photos */
  pending: boolean;
  error: string | null;
  /** Lance la préparation, puis le téléchargement de l'archive */
  start: (request: ArchiveRequest) => void;
  /** Efface l'erreur */
  dismiss: () => void;
};

export function useArchiveDownload(): ArchiveDownload {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abort = useRef<AbortController | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abort.current?.abort();
    };
  }, []);

  const start = useCallback((request: ArchiveRequest) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    setPending(true);
    setError(null);

    fetchArchivePlan(request, controller.signal)
      .then(() => {
        if (!alive.current || controller.signal.aborted) return;
        startArchiveDownload(request);
      })
      .catch((cause: unknown) => {
        if (!alive.current || controller.signal.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Le téléchargement n'a pas pu être préparé.",
        );
      })
      .finally(() => {
        if (alive.current && !controller.signal.aborted) setPending(false);
      });
  }, []);

  const dismiss = useCallback(() => {
    abort.current?.abort();
    setPending(false);
    setError(null);
  }, []);

  return { pending, error, start, dismiss };
}
