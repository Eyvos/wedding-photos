import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GALLERY_PAGE_SIZE, formatBytes } from "@/lib/config";
import { listGuests } from "@/lib/dropbox";
import { findGuest, photoCount, toCard } from "@/lib/gallery";

import PageHeader from "../../components/PageHeader";
import PhotoBrowser from "../../components/PhotoBrowser";

export const dynamic = "force-dynamic";

/** Les photos d'un seul invité, avec de quoi tout emporter d'un coup. */
export default async function GuestPage(props: PageProps<"/photos/[slug]">) {
  const { slug } = await props.params;
  const guest = findGuest(await listGuests(), slug);

  if (!guest) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:py-12">
      <PageHeader
        backHref="/photos?vue=invites"
        backLabel="Tous les invités"
        title={guest.name}
        subtitle={`${photoCount(guest.photos.length)} · ${formatBytes(guest.size)}`}
      />

      {/* La clé force un remontage d'un invité à l'autre : sans elle, React
          garde la grille en place et l'on verrait les photos du précédent. */}
      <PhotoBrowser
        key={guest.slug}
        initial={guest.photos.slice(0, GALLERY_PAGE_SIZE).map(toCard)}
        total={guest.photos.length}
        size={guest.size}
        source={{ scope: "guest", slug: guest.slug }}
        everything={{
          request: { scope: "guests", guests: [guest.name] },
          label: `Télécharger les ${photoCount(guest.photos.length)}`,
        }}
      />
    </main>
  );
}

export async function generateMetadata(
  props: PageProps<"/photos/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const guest = findGuest(await listGuests(), slug);

  return { title: guest ? `Les photos de ${guest.name}` : "Invité introuvable" };
}
