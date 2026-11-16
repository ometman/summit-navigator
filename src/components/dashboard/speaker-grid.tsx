"use client";

import Link from "next/link";
import { useSummitContent } from "@/components/content/summit-content-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SpeakerGrid() {
  const { speakers } = useSummitContent();

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {speakers.map((speaker) => (
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
        <div className="border-t border-border/70 pt-3">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/directory">
              Connect in Leadership Directory
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
