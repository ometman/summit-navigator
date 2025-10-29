import { kpiData } from "@/lib/data";
import { KpiCard } from "./kpi-card";

export function KpiSection() {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {kpiData.map((kpi) => (
        <KpiCard key={kpi.id} {...kpi} />
      ))}
    </section>
  );
}
