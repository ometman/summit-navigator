"use client";

import Link from "next/link";
import Image from "next/image";
import { speakerData } from "@/lib/data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SpeakerGrid() {
  return (
    <TooltipProvider>
      <div className="grid grid-cols-3 gap-4">
        {speakerData.map((speaker) => (
          <Tooltip key={speaker.name}>
            <TooltipTrigger asChild>
              <Link href={`/speaker/${speaker.name.replace(/\s/g, "+")}`}>
                <Avatar className="h-20 w-20 transition-transform duration-200 ease-in-out hover:scale-110">
                  <AvatarImage src={speaker.imageUrl} alt={speaker.name} data-ai-hint={speaker.imageHint} />
                  <AvatarFallback>{speaker.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold">{speaker.name}</p>
              <p className="text-sm text-muted-foreground">{speaker.role}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
