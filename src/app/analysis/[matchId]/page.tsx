import { AnalysisWorkspace } from "@/components/analysis-workspace";

type PageProps = {
  params: Promise<{ matchId: string }>;
};

export default async function AnalysisPage({ params }: PageProps) {
  const { matchId } = await params;
  return <AnalysisWorkspace matchId={matchId} />;
}
