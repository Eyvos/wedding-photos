"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { useCallback, useState } from "react";

import { formatBytes } from "@/lib/config";
import { guestCount, photoCount, type GuestSummary } from "@/lib/gallery";

import ActionBar from "./ActionBar";
import ArchiveDialog from "./ArchiveDialog";
import SelectMark from "./SelectMark";
import Thumb from "./Thumb";
import { DownloadIcon } from "./icons";
import { useArchiveDownload } from "./useArchiveDownload";

/**
 * Qui a envoyé quoi. Une carte par invité : on l'ouvre pour voir ses
 * photos, ou on en coche plusieurs pour tout emporter d'un coup.
 *
 * Les cartes ne reçoivent qu'un résumé — un prénom, deux nombres, quatre
 * chemins d'aperçu. Le détail des photos reste au serveur : c'est la page
 * de l'invité qui ira le chercher, et seulement pour lui.
 */

type Props = {
  guests: GuestSummary[];
  /** Poids de l'album entier, pour le bouton « tout télécharger » */
  total: { count: number; size: number };
};

export default function GuestBrowser({ guests, total }: Props) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const download = useArchiveDownload();

  const toggle = useCallback((guest: GuestSummary) => {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(guest.name)) next.add(guest.name);
      return next;
    });
  }, []);

  if (guests.length === 0) {
    return (
      <p className="rounded-box border border-dashed border-base-300 px-6 py-16 text-center text-base-content/60">
        Personne n&apos;a encore déposé de photos.
      </p>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-base-content/60">
          {guestCount(guests.length)} · {formatBytes(total.size)}
        </p>
        <button
          type="button"
          className="btn btn-sm btn-outline border-base-300 font-normal"
          onClick={() => download.start({ scope: "all" })}
          disabled={download.pending}
        >
          {download.pending ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              Préparation…
            </>
          ) : (
            <>
              <DownloadIcon className="size-4" />
              Tout télécharger
            </>
          )}
        </button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {guests.map((guest) => (
          <li key={guest.slug} className="tile-card relative">
            <Link
              href={`/photos/${guest.slug}`}
              className="flex items-center gap-4 rounded-box border border-base-300 bg-base-100/80 p-3 backdrop-blur transition-colors hover:border-primary/50 hover:bg-base-100"
            >
              <GuestPreview guest={guest} />

              <div className="min-w-0 flex-1 pr-9">
                <p className="truncate font-display text-2xl font-medium">
                  {guest.name}
                </p>
                <p className="flex items-center gap-2 text-sm text-base-content/60">
                  {photoCount(guest.count)} · {formatBytes(guest.size)}
                  <OpeningHint />
                </p>
              </div>
            </Link>

            <SelectMark
              checked={selected.has(guest.name)}
              onChange={() => toggle(guest)}
              label={`Sélectionner les photos de ${guest.name}`}
              variant="card"
              className="absolute right-3 top-1/2 -translate-y-1/2"
            />
          </li>
        ))}
      </ul>

      {selected.size > 0 && (
        <ActionBar
          summary={`${guestCount(selected.size)} sélectionné${selected.size > 1 ? "s" : ""}`}
          pending={download.pending}
          onClear={() => setSelected(new Set())}
          onDownload={() =>
            download.start({ scope: "guests", guests: [...selected] })
          }
        />
      )}

      <ArchiveDialog download={download} />
    </>
  );
}

/**
 * La page d'un invité se fabrique à la demande : entre le clic et son
 * affichage, ce point qui tourne dit que c'est parti. Il occupe sa place en
 * permanence pour ne pas décaler la ligne en apparaissant.
 */
function OpeningHint() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden
      className={`loading loading-spinner loading-xs shrink-0 transition-opacity ${
        pending ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}

/** Mosaïque de quatre vignettes — l'ambiance de l'invité en un coup d'œil */
function GuestPreview({ guest }: { guest: GuestSummary }) {
  return (
    <div className="grid size-20 shrink-0 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-field bg-base-200">
      {guest.preview.map((path) => (
        <span
          key={path}
          className={`block size-full overflow-hidden ${
            // Une photo seule occupe toute la case plutôt qu'un quart perdu
            guest.preview.length === 1 ? "col-span-2 row-span-2" : ""
          }`}
        >
          <Thumb
            photo={{ path, name: "", guest: guest.name }}
            size="w256h256"
            alt=""
          />
        </span>
      ))}
    </div>
  );
}
