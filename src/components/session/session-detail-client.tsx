'use client';

import { Download, FileText, Layers } from 'lucide-react';
import { type Session } from '@/lib/data';
import {
  buildSessionGuideContent,
  triggerFileDownload,
} from '@/lib/presentation-data';
import { useSummitContent } from '@/components/content/summit-content-provider';
import SessionHeader from '@/components/session/session-header';
import SessionStats from '@/components/session/session-stats';
import GenericContent from '@/components/session/content/generic';
import Session2Content from '@/components/session/content/session-2';
import Session3Content from '@/components/session/content/session-3';
import Session4Content from '@/components/session/content/session-4';
import Session5Content from '@/components/session/content/session-5';
import Session6Content from '@/components/session/content/session-6';
import AiSummary from '@/components/session/ai-summary';
import { LivePolls } from '@/components/session/live-polls';
import { QandA } from '@/components/session/q-and-a';
import { SessionActionChecklist } from '@/components/session/session-action-checklist';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const contentComponents: { [key: number]: React.FC<{ session: Session }> } = {
  2: Session2Content,
  3: Session3Content,
  4: Session4Content,
  5: Session5Content,
  6: Session6Content,
};

export function SessionDetailClient({
  baseSession,
  borderColor,
}: {
  baseSession: Session;
  borderColor: string;
}) {
  const { toast } = useToast();
  const {
    getEffectiveSession,
    slidesBySessionId,
    studyPacketsBySessionId,
  } = useSummitContent();

  const session = getEffectiveSession(baseSession.id) || baseSession;
  const slides = slidesBySessionId[session.id] || [];
  const studyPacket = studyPacketsBySessionId[session.id];
  const ContentComponent = contentComponents[session.id] || GenericContent;

  const handleDownloadPacket = (format: 'md' | 'txt') => {
    const file = buildSessionGuideContent(session, format, slides, studyPacket);
    triggerFileDownload(file.filename, file.content, file.mimeType);
    toast({
      title: 'Study packet downloaded',
      description: `Saved ${file.filename}`,
    });
  };

  return (
    <div
      className="bg-white rounded-xl shadow-2xl p-6 md:p-10 border-l-8 mb-12"
      style={{ borderColor }}
    >
      <SessionHeader session={session} />
      <hr className="mb-6 mt-4" />
      <SessionStats session={session} />

      <AiSummary
        speaker={session.speaker}
        topic={session.title}
        intendedAudience={session.summary}
      />

      {studyPacket && (
        <section className="my-6 rounded-xl border border-border bg-muted/20 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <FileText className="h-4 w-4 text-primary" />
                <span>Downloadable Study Packet</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Layers className="h-3.5 w-3.5" />
                  {slides.length} {slides.length === 1 ? 'slide' : 'slides'}
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground">
                {studyPacket.title}
              </h3>
              {studyPacket.notes && (
                <p className="text-sm text-muted-foreground whitespace-pre-line pt-1">
                  {studyPacket.notes}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDownloadPacket('md')}
              >
                <Download className="h-4 w-4 mr-1.5" />
                Packet (.md)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDownloadPacket('txt')}
              >
                <Download className="h-4 w-4 mr-1.5" />
                Text (.txt)
              </Button>
            </div>
          </div>
        </section>
      )}

      <LivePolls sessionId={session.id.toString()} />

      <QandA sessionId={session.id.toString()} />

      <SessionActionChecklist sessionId={session.id.toString()} />

      <h3 className="text-2xl font-bold text-gray-800 mb-4 mt-8 border-b pb-2">
        Session Overview
      </h3>
      <ContentComponent session={session} />
    </div>
  );
}
