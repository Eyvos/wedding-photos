"use client";

import { create as createQr } from "qrcode";
import { useEffect, useRef, useState } from "react";

import { CheckIcon, LinkIcon, QrIcon } from "./icons";

/** Modules blancs autour du code : 4 est le minimum de la norme QR. */
const QR_MARGIN = 4;

/** Retour visuel après une copie, en millisecondes */
const COPIED_FEEDBACK_MS = 2000;

type CopyState = "idle" | "copied" | "failed";

type Qr = {
  url: string;
  /** Attribut `d` d'un <path> SVG */
  d: string;
  viewBox: string;
};

/**
 * L'adresse du site dépend du domaine servi (local, Vercel, nom de domaine
 * final) : on la lit dans le navigateur plutôt que de la figer dans la config.
 */
function siteUrl(): string {
  const { origin, pathname } = window.location;
  return (origin + pathname).replace(/\/$/, "");
}

export default function ShareActions() {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  /** Calculé au premier clic seulement : inutile d'encoder un QR jamais ouvert */
  const [qr, setQr] = useState<Qr | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = setTimeout(() => setCopyState("idle"), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copyState]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(siteUrl());
      setCopyState("copied");
    } catch {
      // Safari refuse le presse-papiers hors contexte sécurisé (http://…)
      setCopyState("failed");
    }
  }

  function showQr() {
    const url = siteUrl();
    setQr({ url, ...qrPathData(url) });
    dialogRef.current?.showModal();
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className="btn btn-sm btn-outline border-base-300 font-normal"
          onClick={copyLink}
        >
          {copyState === "copied" ? (
            <CheckIcon className="size-4 text-accent" />
          ) : (
            <LinkIcon className="size-4" />
          )}
          {copyState === "copied" ? "Lien copié" : "Copier le lien"}
        </button>

        <button
          type="button"
          className="btn btn-sm btn-outline border-base-300 font-normal"
          onClick={showQr}
        >
          <QrIcon className="size-4" />
          Afficher le QR code
        </button>
      </div>

      {copyState === "failed" && (
        <p className="mt-2 text-center text-sm text-error">
          Copie impossible — passe par le QR code.
        </p>
      )}

      <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle">
        <div className="modal-box">
          <h2 className="font-display text-2xl font-medium">
            Scanne pour ouvrir le site
          </h2>

          {qr && (
            <>
              <div className="mt-5 flex justify-center">
                {/* fond blanc imposé : un QR sur fond crème passe mal au scan */}
                <svg
                  viewBox={qr.viewBox}
                  className="size-64 max-w-full rounded-box bg-white p-1 text-black"
                  shapeRendering="crispEdges"
                  role="img"
                  aria-label={`QR code vers ${qr.url}`}
                >
                  <path d={qr.d} fill="currentColor" />
                </svg>
              </div>

              <p className="mt-4 break-all text-center text-sm text-base-content/60">
                {qr.url}
              </p>
            </>
          )}

          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost">Fermer</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="Fermer">close</button>
        </form>
      </dialog>
    </div>
  );
}

/**
 * Encode `text` en QR et renvoie de quoi dessiner un <path> :
 * un carré de 1×1 par module noir, dans un viewBox à l'échelle des modules.
 */
function qrPathData(text: string): Omit<Qr, "url"> {
  const { modules } = createQr(text, { errorCorrectionLevel: "medium" });
  const { size, data } = modules;

  let d = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (data[row * size + col]) {
        d += `M${col + QR_MARGIN} ${row + QR_MARGIN}h1v1h-1z`;
      }
    }
  }

  const side = size + QR_MARGIN * 2;
  return { d, viewBox: `0 0 ${side} ${side}` };
}
