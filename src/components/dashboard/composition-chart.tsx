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
import { agendaData } from "@/lib/data"

const totalContent = agendaData.reduce((sum, s) => sum + s.content, 0);
const totalQa = agendaData.reduce((sum, s) => sum + s.qa, 0);
const totalPrayer = agendaData.reduce((sum, s) => sum + s.prayer, 0);

const chartData = [
  { type: "Content & Teaching", value: totalContent, fill: "var(--color-content)" },
  { type: "Dedicated Q&A", value: totalQa, fill: "var(--color-qa)" },
  { type: "Prayer & Transition", value: totalPrayer, fill: "var(--color-prayer)" },
]

const chartConfig = {
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
}

export function CompositionChart() {
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
