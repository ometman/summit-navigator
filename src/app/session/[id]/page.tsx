import { notFound } from "next/navigation";
import { agendaData, type Session } from "@/lib/data";
import BackButton from "@/components/session/back-button";
import SessionHeader from "@/components/session/session-header";
import SessionStats from "@/components/session/session-stats";
import GenericContent from "@/components/session/content/generic";
import Session2Content from "@/components/session/content/session-2";
import Session3Content from "@/components/session/content/session-3";
import Session6Content from "@/components/session/content/session-6";

const contentComponents: { [key: number]: React.FC<{ session: Session }> } = {
  2: Session2Content,
  3: Session3Content,
  6: Session6Content,
};

export default function SessionPage({ params }: { params: { id: string } }) {
  const session = agendaData.find((s) => s.id === parseInt(params.id, 10));

  if (!session) {
    notFound();
  }

  const colors = ['#375EAB', '#50E3C2', '#F5A623', '#FF6B6B', '#8338EC', '#3A86FF'];
  const borderColor = colors[(session.id - 1) % colors.length];

  const ContentComponent = contentComponents[session.id] || GenericContent;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="mb-6">
        <BackButton />
      </div>
      <div
        className="bg-white rounded-xl shadow-2xl p-6 md:p-10 border-l-8 mb-12"
        style={{ borderColor: borderColor }}
      >
        <SessionHeader session={session} />
        <hr className="mb-6 mt-4" />
        <SessionStats session={session} />
        <h3 className="text-2xl font-bold text-gray-800 mb-4 mt-8 border-b pb-2">Session Overview</h3>
        <ContentComponent session={session} />
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return agendaData.map((session) => ({
    id: session.id.toString(),
  }));
}
