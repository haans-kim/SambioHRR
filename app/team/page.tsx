// Legacy prototype page. Redirect to the new teams page to avoid confusion.
import { redirect } from "next/navigation";

interface TeamPageProps {
  searchParams: Promise<{ center?: string; division?: string }>;
}

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const params = await searchParams;
  const centerCode = params.center;
  const divisionCode = params.division;
  if (divisionCode) redirect(`/teams?division=${divisionCode}`);
  if (centerCode) redirect(`/teams?center=${centerCode}`);
  redirect('/');
}