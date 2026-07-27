import { prisma } from "@/lib/prisma";

type Resource = "seasons" | "clubs" | "competitions";
const valid = (value: string): value is Resource => ["seasons", "clubs", "competitions"].includes(value);

export async function GET(_: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  if (!valid(resource)) return Response.json({ error: "Recurso inválido." }, { status: 404 });
  if (resource === "seasons") return Response.json(await prisma.season.findMany({ orderBy: { name: "desc" } }));
  if (resource === "clubs") return Response.json(await prisma.club.findMany({ orderBy: { name: "asc" } }));
  const records = await prisma.competition.findMany({ include: { clubs: { select: { id: true } } }, orderBy: { name: "asc" } });
  return Response.json(records.map(({ clubs, ...record }) => ({ ...record, clubIds: clubs.map((club) => club.id) })));
}

export async function POST(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  if (!valid(resource)) return Response.json({ error: "Recurso inválido." }, { status: 404 });
  const body = await request.json() as { name?: string; shortName?: string; startDate?: string; endDate?: string; seasonId?: string; clubIds?: string[] };
  const name = body.name?.trim();
  if (!name) return Response.json({ error: "O nome é obrigatório." }, { status: 400 });
  try {
    const record = resource === "seasons"
      ? await prisma.season.create({ data: { name, startDate: body.startDate ? new Date(body.startDate) : null, endDate: body.endDate ? new Date(body.endDate) : null } })
      : resource === "clubs" ? await prisma.club.create({ data: { name, shortName: body.shortName?.trim() || null } })
      : await prisma.competition.create({ data: { name, seasonId: body.seasonId || null, clubs: { connect: (body.clubIds || []).map((id) => ({ id })) } } });
    return Response.json(record, { status: 201 });
  } catch { return Response.json({ error: "Já existe um registo com este nome." }, { status: 409 }); }
}
