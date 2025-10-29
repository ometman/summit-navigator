import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  id: string;
  borderColor: string;
}

export function KpiCard({ title, value, id, borderColor }: KpiCardProps) {
  return (
    <Card className={cn("text-center border-b-4 shadow", borderColor)}>
      <CardHeader className="p-5 pb-0">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-1">
        <p id={id} className="text-4xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
