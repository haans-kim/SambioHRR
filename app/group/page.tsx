// Legacy prototype page. Redirect to the new groups page to avoid confusion.
import { redirect } from "next/navigation";

interface GroupPageProps {
  searchParams: Promise<{ team?: string }>;
}

export default async function GroupPage({ searchParams }: GroupPageProps) {
  const params = await searchParams;
  const teamCode = params.team;
  if (teamCode) redirect(`/groups?team=${teamCode}`);
  redirect('/');
}