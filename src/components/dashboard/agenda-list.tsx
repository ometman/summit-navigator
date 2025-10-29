"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { agendaData, type Session } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function SessionItem({
  session,
  isSelected,
  onSelect,
}: {
  session: Session;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const speakerUrl = `/speaker/${session.speaker.replace(/\s/g, "+")}`;
  return (
    <div
      id={`session-${session.id}`}
      className={cn(
        "bg-card rounded-lg cursor-pointer hover:bg-muted/50 transition duration-150 ease-in-out border-l-4 shadow-sm",
        isSelected ? "border-primary" : "border-gray-300"
      )}
      onClick={onSelect}
    >
      <div className="flex justify-between items-center p-4">
        <div>
          <p className="text-sm font-mono text-muted-foreground">{session.time}</p>
          <p className="text-lg font-semibold text-foreground">{session.title}</p>
          <p className="text-sm text-muted-foreground">
            Speaker:{" "}
            <Link href={speakerUrl} className="font-semibold text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                {session.speaker}
            </Link>
          </p>
        </div>
        <Button
          asChild
          className="whitespace-nowrap"
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={`/session/${session.id}`}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Details
          </Link>
        </Button>
      </div>
      {isSelected && (
        <div className="p-4 pt-3 border-t bg-muted/30 text-muted-foreground">
          <h4 className="text-base font-bold text-primary mb-3">Time Breakdown</h4>
          <div className="grid grid-cols-3 gap-2 text-center text-sm font-medium">
            <div className="p-2 bg-green-100 rounded">
              <span className="text-green-800">Content: <span className="font-bold">{session.content} min</span></span>
            </div>
            <div className="p-2 bg-blue-100 rounded">
              <span className="text-blue-800">Q&A: <span className="font-bold">{session.qa} min</span></span>
            </div>
            <div className="p-2 bg-red-100 rounded">
              <span className="text-red-800">Prayer: <span className="font-bold">{session.prayer} min</span></span>
            </div>
          </div>
          <p className="mt-3 text-xs">
            {session.summary.substring(0, 120)}...
            <Link href={`/session/${session.id}`} className="font-bold text-primary hover:underline ml-1">
              Click Details for full content.
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

export function AgendaList() {
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const morningSessions = agendaData.filter((s) => !s.afternoon);
  const afternoonSessions = agendaData.filter((s) => s.afternoon);

  const handleSelect = (sessionId: number) => {
    setSelectedSessionId((prev) => (prev === sessionId ? null : sessionId));
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xl font-semibold mt-4 mb-2 text-primary">Morning Sessions</h3>
        <div className="space-y-3">
          {morningSessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isSelected={selectedSessionId === session.id}
              onSelect={() => handleSelect(session.id)}
            />
          ))}
        </div>
      </div>

      <div className="p-3 bg-yellow-100 rounded-md text-sm font-medium text-yellow-800 shadow-inner my-2">
        12:00 PM - 12:45 PM: Lunch Break (45 min)
      </div>

      <div>
        <h3 className="text-xl font-semibold mt-4 mb-2 text-primary">Afternoon Sessions</h3>
        <div className="space-y-3">
          {afternoonSessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isSelected={selectedSessionId === session.id}
              onSelect={() => handleSelect(session.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
