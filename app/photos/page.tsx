import type { Metadata } from "next";

import { GALLERY_PAGE_SIZE, GUEST_PREVIEW_COUNT } from "@/lib/config";
import { listGuests } from "@/lib/dropbox";
import {
  allPhotos,
  photoCount,
  summarize,
  toCard,
  totalPhotos,
  totalSize,
} from "@/lib/gallery";

import GuestBrowser from "../components/GuestBrowser";
import PageHeader from "../components/PageHeader";
import PhotoBrowser from "../components/PhotoBrowser";
import GalleryError from "./GalleryError";
import ViewTabs from "./ViewTabs";

export const metadata: Metadata = { title: "Voir et récupérer les photos" };

/** L'album change au fil des dépôts : rien à figer au moment du déploiement. */
export const dynamic = "force-dynamic";

export default async function PhotosPage(props: PageProps<"/photos">) {
  const { vue } = await props.searchParams;
  const byGuest = vue === "invites";

  const guests = await listGuests().catch((error: unknown) => {
    console.error("galerie : listing impossible —", error);
    return null;
  });

  // Ce que le navigateur reçoit est volontairement maigre : une première
  // tranche de vignettes ou des résumés d'invités. Le reste vient au fil du
  // défilement, sinon un album bien rempli se paierait d'emblée en centaines
  // de kilo-octets et d'un long silence.
  //
  // Le tri chronologique de l'album entier ne sert qu'à la vue « en vrac » :
  // la vue par invité s'en passe, ses photos étant déjà rangées par prénom.
  const photos = guests && !byGuest ? allPhotos(guests) : [];
  const count = guests ? totalPhotos(guests) : 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:py-12">
      <PageHeader
        backHref="/"
        backLabel="Accueil"
        title="Les photos du mariage"
        subtitle={
          guests ? `${photoCount(count)} déposées par les invités.` : undefined
        }
      />

      {guests === null ? (
        <GalleryError />
      ) : (
        <>
          <ViewTabs byGuest={byGuest} />

          {byGuest ? (
            <GuestBrowser
              guests={guests.map((guest) => summarize(guest, GUEST_PREVIEW_COUNT))}
              total={{ count, size: totalSize(guests) }}
            />
          ) : (
            <PhotoBrowser
              initial={photos.slice(0, GALLERY_PAGE_SIZE).map(toCard)}
              total={photos.length}
              size={totalSize(guests)}
              source={{ scope: "all" }}
              everything={{ request: { scope: "all" }, label: "Tout télécharger" }}
            />
          )}
        </>
      )}
    </main>
  );
}
