"use client"

import * as React from "react"
import { Bar, BarChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { agendaData } from "@/lib/data"

// Utility function to wrap long chart labels
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

    return Object.entries(speakerMins)
        .map(([speaker, minutes]) => ({ speaker, minutes }))
        .sort((a, b) => a.minutes - b.minutes);
};

const chartData = getSpeakerData();

const chartConfig = {
  minutes: {
    label: "Minutes",
    color: "hsl(var(--chart-1))",
  },
}

export function SpeakerChart() {
  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <BarChart
        accessibilityLayer
        data={chartData}
        layout="vertical"
        margin={{ left: 10, right: 10 }}
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
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent labelKey="minutes" />}
        />
        <Bar dataKey="minutes" layout="vertical" radius={5} fill="var(--color-minutes)" />
      </BarChart>
    </ChartContainer>
  )
}
