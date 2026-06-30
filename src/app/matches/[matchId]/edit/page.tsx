import { MatchForm } from "@/components/match-form";

type PageProps = {
  params: Promise<{ matchId: string }>;
};

export default async function EditMatchPage({ params }: PageProps) {
  const { matchId } = await params;
  return <MatchForm mode="edit" matchId={matchId} />;
}
