import { SubmomentEditor } from "@/components/submoment-editor";
import { normalizeAnalysisPerspective } from "@/lib/analysis-perspective";

export default async function SubmomentsPage({ params, searchParams }: { params: Promise<{ matchId: string }>; searchParams: Promise<{ perspective?: string | string[] }> }) {
  const { matchId } = await params;
  const { perspective } = await searchParams;
  return <SubmomentEditor matchId={matchId} perspective={normalizeAnalysisPerspective(perspective)} />;
}
