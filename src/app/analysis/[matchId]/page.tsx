import { AnalysisWorkspace } from "@/components/analysis-workspace";
import { normalizeAnalysisPerspective } from "@/lib/analysis-perspective";

type PageProps = {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ perspective?: string | string[] }>;
};

export default async function AnalysisPage({ params, searchParams }: PageProps) {
  const { matchId } = await params;
  const { perspective } = await searchParams;
  return <AnalysisWorkspace matchId={matchId} perspective={normalizeAnalysisPerspective(perspective)} />;
}
