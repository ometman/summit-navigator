import { notFound } from "next/navigation";
import { agendaData } from "@/lib/data";
import BackButton from "@/components/session/back-button";
import { SessionDetailClient } from "@/components/session/session-detail-client";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = agendaData.find((s) => s.id === parseInt(id, 10));

  if (!session) {
    notFound();
  }

  const colors = ['#375EAB', '#50E3C2', '#F5A623', '#FF6B6B', '#8338EC', '#3A86FF'];
  const borderColor = colors[(session.id - 1) % colors.length];

  return (
    <>
      <div className="mb-6">
        <BackButton />
      </div>
      <SessionDetailClient baseSession={session} borderColor={borderColor} />
    </>
  );
}

export function generateStaticParams() {
  return agendaData.map((session) => ({
    id: session.id.toString(),
  }));
}
