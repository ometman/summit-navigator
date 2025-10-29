"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { agendaData } from "@/lib/data"

function wrapLabel(label: string) {
    if (label.length <= 16) {
        return label;
    }
    const words = label.split(' ');
    let lines: string[] = [];
    let currentLine = '';
    words.forEach(word => {
        if (currentLine.length + word.length + 1 > 16 && currentLine.length > 0) {
            lines.push(currentLine.trim());
            currentLine = word + ' ';
        } else {
            currentLine += word + ' ';
        }
    });
    if (currentLine.trim().length > 0) {
        lines.push(currentLine.trim());
    }
    return lines;
}

const getSpeakerData = () => {
    const speakerMins: { [key: string]: number } = {};
    agendaData.forEach(session => {
        const totalMinutes = session.content + session.qa + session.prayer;
        speakerMins[session.speaker] = (speakerMins[session.speaker] || 0) + totalMinutes;
    });

    const chartColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

    return Object.entries(speakerMins)
        .map(([speaker, minutes], index) => ({ 
            speaker, 
            minutes,
            fill: chartColors[index % chartColors.length] 
        }))
        .sort((a, b) => a.minutes - b.minutes);
};

const chartData = getSpeakerData();

const chartConfig = {
  minutes: {
    label: "Minutes",
  },
};

chartData.forEach((data, index) => {
    chartConfig[data.speaker] = {
        label: data.speaker,
        color: `hsl(var(--chart-${(index % 5) + 1}))`,
    };
});

export function SpeakerChart() {
  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <BarChart
        accessibilityLayer
        data={chartData}
        layout="vertical"
        margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
      >
        <YAxis
          dataKey="speaker"
          type="category"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => {
            const wrapped = wrapLabel(value);
            return Array.isArray(wrapped) ? wrapped[0] : wrapped;
          }}
          className="text-muted-foreground"
        />
        <XAxis dataKey="minutes" type="number" hide />
        <CartesianGrid horizontal={false} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dot" />}
        />
        <Bar dataKey="minutes" layout="vertical" radius={5} />
      </BarChart>
    </ChartContainer>
  )
}