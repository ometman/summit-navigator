import { KpiSection } from "@/components/dashboard/kpi-section";
import { AgendaList } from "@/components/dashboard/agenda-list";
import { CompositionChart } from "@/components/dashboard/composition-chart";
import { SpeakerChart } from "@/components/dashboard/speaker-chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Home() {
  return (
    <>
      <KpiSection />

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-foreground mb-2 border-b pb-2">Interactive Seminar Agenda</CardTitle>
              <CardDescription>
                Click any session to toggle its detailed timing breakdown, or use the "Details" button for a dedicated summary page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AgendaList />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-8">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-foreground mb-2 border-b pb-2">Total Program Composition</CardTitle>
              <CardDescription>A breakdown of the 6 hours of structured session time.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <CompositionChart />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <section className="mt-8">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-foreground mb-2 border-b pb-2">Speaker Content Allocation</CardTitle>
            <CardDescription>Minutes of content delivery per expert speaker.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 max-h-96">
                <SpeakerChart />
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
