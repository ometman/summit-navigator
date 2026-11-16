"use client"

import * as React from "react"
import { Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { useSummitContent } from "@/components/content/summit-content-provider"

export function CompositionChart() {
  const { sessions } = useSummitContent();

  const { chartData, chartConfig } = React.useMemo(() => {
    const totalContent = sessions.reduce((sum, s) => sum + s.content, 0);
    const totalQa = sessions.reduce((sum, s) => sum + s.qa, 0);
    const totalPrayer = sessions.reduce((sum, s) => sum + s.prayer, 0);

    return {
      chartData: [
        { type: "Content & Teaching", value: totalContent, fill: "var(--color-content)" },
        { type: "Dedicated Q&A", value: totalQa, fill: "var(--color-qa)" },
        { type: "Prayer & Transition", value: totalPrayer, fill: "var(--color-prayer)" },
      ],
      chartConfig: {
        value: {
          label: "Minutes",
        },
        content: {
          label: `Content & Teaching (${totalContent} min)`,
          color: "hsl(var(--chart-1))",
        },
        qa: {
          label: `Dedicated Q&A (${totalQa} min)`,
          color: "hsl(var(--chart-2))",
        },
        prayer: {
          label: `Prayer & Transition (${totalPrayer} min)`,
          color: "hsl(var(--chart-3))",
        },
      },
    };
  }, [sessions]);

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="type"
          innerRadius={60}
          strokeWidth={5}
        />
        <ChartLegend
          content={<ChartLegendContent nameKey="type" />}
          className="-mt-2"
        />
      </PieChart>
    </ChartContainer>
  )
}
