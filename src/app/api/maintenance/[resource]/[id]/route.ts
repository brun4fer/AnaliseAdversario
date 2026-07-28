import { prisma } from "@/lib/prisma";
import { requireCurrentUserId } from "@/lib/auth";
type Resource = "seasons" | "clubs" | "competitions";
const valid = (value: string): value is Resource => ["seasons", "clubs", "competitions"].includes(value);

export async function PATCH(request: Request, { params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await params;
  if (!valid(resource)) return Response.json({ error: "Recurso inválido." }, { status: 404 });
  const ownerId = await requireCurrentUserId();
  const owned = resource === "seasons" ? await prisma.season.findFirst({ where: { id, ownerId } }) : resource === "clubs" ? await prisma.club.findFirst({ where: { id, ownerId } }) : await prisma.competition.findFirst({ where: { id, ownerId } });
  if (!owned) return Response.json({ error: "Registo não encontrado." }, { status: 404 });
  const body = await request.json() as { name?: string; shortName?: string; startDate?: string; endDate?: string; seasonId?: string; clubIds?: string[] };
  const name = body.name?.trim();
  if (!name) return Response.json({ error: "O nome é obrigatório." }, { status: 400 });
  if (resource === "competitions") {
    const clubIds = [...new Set(body.clubIds || [])];
    const [season, clubCount] = await Promise.all([
      prisma.season.findFirst({ where: { id: body.seasonId || "", ownerId }, select: { id: true } }),
      prisma.club.count({ where: { id: { in: clubIds }, ownerId } }),
    ]);
    if (!season || clubCount !== clubIds.length) return Response.json({ error: "Temporada ou clubes inválidos." }, { status: 400 });
  }
  const record = resource === "seasons" ? await prisma.season.update({ where: { id }, data: { name, startDate: body.startDate ? new Date(body.startDate) : null, endDate: body.endDate ? new Date(body.endDate) : null } }) : resource === "clubs" ? await prisma.club.update({ where: { id }, data: { name, shortName: body.shortName?.trim() || null } }) : await prisma.competition.update({ where: { id }, data: { name, seasonId: body.seasonId || null, clubs: { set: (body.clubIds || []).map((clubId) => ({ id: clubId })) } } });
  return Response.json(record);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await params;
  if (!valid(resource)) return Response.json({ error: "Recurso inválido." }, { status: 404 });
  const ownerId = await requireCurrentUserId();
  const owned = resource === "seasons" ? await prisma.season.findFirst({ where: { id, ownerId } }) : resource === "clubs" ? await prisma.club.findFirst({ where: { id, ownerId } }) : await prisma.competition.findFirst({ where: { id, ownerId } });
  if (!owned) return Response.json({ error: "Registo não encontrado." }, { status: 404 });
  if (resource === "seasons") await prisma.season.delete({ where: { id } }); else if (resource === "clubs") await prisma.club.delete({ where: { id } }); else await prisma.competition.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
