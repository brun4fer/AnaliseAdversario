import { SubmomentEditor } from "@/components/submoment-editor";

export default async function SubmomentsPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <SubmomentEditor matchId={matchId} />;
}
