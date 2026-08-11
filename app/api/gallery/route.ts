import { galleryDataHeaders } from "@/lib/cache-headers";
import { GALLERY_PAGE_SIZE } from "@/lib/config";
import { listGuests } from "@/lib/dropbox";
import {
  photosOf,
  toCard,
  type PhotoPage,
  type PhotoSource,
} from "@/lib/gallery";

/**
 * GET /api/gallery?scope=all&offset=60
 * GET /api/gallery?scope=guest&slug=elodie&offset=60
 *
 * Une tranche de la grille. La page de départ arrive déjà rendue par le
 * serveur ; c'est cette route qui fournit les suivantes au fil du défilement,
 * pour qu'un album de plusieurs milliers de photos ne soit ni transmis ni
 * dessiné d'un seul bloc.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const slug = searchParams.get("slug");
  const source: PhotoSource | null =
    searchParams.get("scope") === "guest"
      ? slug
        ? { scope: "guest", slug }
        : null
      : { scope: "all" };

  if (!source) {
    return Response.json({ error: "Invité non précisé." }, { status: 400 });
  }

  const offset = positiveInt(searchParams.get("offset"), 0);
  const limit = Math.min(
    positiveInt(searchParams.get("limit"), GALLERY_PAGE_SIZE),
    GALLERY_PAGE_SIZE * 4,
  );

  const guests = await listGuests().catch((error: unknown) => {
    console.error("galerie : listing impossible —", error);
    return null;
  });

  if (!guests) {
    return Response.json(
      { error: "L'album est momentanément injoignable." },
      { status: 502 },
    );
  }

  const photos = photosOf(guests, source);
  const page: PhotoPage = {
    photos: photos.slice(offset, offset + limit).map(toCard),
    total: photos.length,
  };

  return new Response(JSON.stringify(page), { headers: galleryDataHeaders() });
}

function positiveInt(raw: string | null, fallback: number): number {
  // `Number(null)` et `Number("")` valent 0, pas NaN : sans ce garde, un
  // paramètre absent vaudrait zéro. Une demande sans `limit` renverrait
  // alors une tranche vide au lieu de la tranche par défaut.
  if (raw === null || raw.trim() === "") return fallback;

  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}
