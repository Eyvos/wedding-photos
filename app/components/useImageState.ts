"use client";

import { useCallback, useState } from "react";

/**
 * Où en est une image : en attente, affichée, ou perdue.
 *
 * Le piège que ce petit crochet existe pour éviter : une image peut être
 * *déjà* chargée quand React s'attache à elle — venue du cache, ou lancée
 * par le HTML du serveur avant l'hydratation. Son évènement `load` est alors
 * passé depuis longtemps, et l'attendre reviendrait à laisser un carré vide
 * sous une photo pourtant présente. D'où la vérification à la pose du ref.
 */

export type ImageState = "loading" | "shown" | "failed";

export function useImageState() {
  const [state, setState] = useState<ImageState>("loading");

  const ref = useCallback((node: HTMLImageElement | null) => {
    // `naturalWidth` à 0 sur une image complète : le chargement a échoué.
    if (node?.complete) setState(node.naturalWidth > 0 ? "shown" : "failed");
  }, []);

  return {
    state,
    /** À étaler sur la balise `<img>` */
    bind: {
      ref,
      onLoad: () => setState("shown"),
      onError: () => setState("failed"),
    },
  };
}
