'use client';

import { useSummitContent } from "@/components/content/summit-content-provider";
import { KpiCard } from "./kpi-card";

export function KpiSection() {
  const { sessions } = useSummitContent();

  const items = [
    {
      title: 'Total Sessions',
      value: sessions.length,
      borderColor: 'border-primary',
      id: 'kpi-sessions',
    },
    {
      title: 'Content Time',
      value: `${sessions.reduce((acc, session) => acc + session.content, 0)} min`,
      borderColor: 'border-[#50E3C2]',
      id: 'kpi-content',
    },
    {
      title: 'Dedicated Q&A',
      value: `${sessions.reduce((acc, session) => acc + session.qa, 0)} min`,
      borderColor: 'border-yellow-500',
      id: 'kpi-qa',
    },
    {
      title: 'Expert Speakers',
      value: new Set(sessions.map((session) => session.speaker)).size,
      borderColor: 'border-red-500',
      id: 'kpi-speakers',
    },
  ];

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {items.map((kpi) => (
        <KpiCard key={kpi.id} {...kpi} />
      ))}
    </section>
  );
}
