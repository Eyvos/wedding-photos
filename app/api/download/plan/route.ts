import {
  ArchiveError,
  readArchiveRequest,
  resolveArchive,
} from "@/lib/archive-server";

/**
 * POST /api/download/plan — ce que pèse la demande.
 *
 * Le navigateur interroge cette route avant de lancer le téléchargement :
 * c'est sa seule occasion d'apprendre qu'une demande n'aboutira pas et de le
 * dire dans la page, l'archive partant ensuite par un formulaire qui, lui,
 * emporterait la galerie avec lui en cas d'erreur. Mêmes champs que
 * `/api/download`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Demande illisible." }, { status: 400 });
  }

  const wanted = readArchiveRequest(form);
  if (!wanted) {
    return Response.json(
      { error: "Demande de téléchargement incomplète." },
      { status: 400 },
    );
  }

  try {
    const { plan } = await resolveArchive(wanted);
    return Response.json(plan, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ArchiveError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
