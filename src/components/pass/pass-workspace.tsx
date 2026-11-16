'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, QrCode, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttendeePassCard } from '@/components/pass/attendee-pass-card';
import { OrganizerScanner } from '@/components/pass/organizer-scanner';
import { useFirebase } from '@/firebase';
import { checkUserModeratorAccess } from '@/firebase/qa';
import { cn } from '@/lib/utils';

type WorkspaceMode = 'pass' | 'scanner';

export function PassWorkspace({
  initialMode = 'pass',
}: {
  initialMode?: WorkspaceMode;
}) {
  const { firestore, auth, user, isUserLoading, isMfaVerified } = useFirebase();
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [mode, setMode] = useState<WorkspaceMode>(initialMode);

  const canModerate = Boolean(
    user && !user.isAnonymous && user.emailVerified && isMfaVerified && isOrganizer
  );

  useEffect(() => {
    let active = true;
    if (!firestore || isUserLoading) return;
    if (!user || user.isAnonymous || !user.emailVerified) {
      setIsOrganizer(false);
      return;
    }

    checkUserModeratorAccess(firestore, auth, user)
      .then((allowed) => {
        if (active) setIsOrganizer(allowed);
      })
      .catch(() => {
        if (active) setIsOrganizer(false);
      });

    return () => {
      active = false;
    };
  }, [firestore, auth, user, isUserLoading]);

  // Keep non-organizers on My Digital Pass view
  const effectiveMode: WorkspaceMode =
    mode === 'scanner' && canModerate ? 'scanner' : 'pass';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" asChild className="self-start">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        {canModerate && (
          <div
            className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-1 self-start sm:self-auto"
            role="tablist"
            aria-label="Digital pass and organizer scanner"
          >
            <button
              type="button"
              role="tab"
              aria-selected={effectiveMode === 'pass'}
              onClick={() => setMode('pass')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                effectiveMode === 'pass'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <QrCode className="h-3.5 w-3.5" />
              My Digital Pass
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={effectiveMode === 'scanner'}
              onClick={() => setMode('scanner')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                effectiveMode === 'scanner'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <ScanLine className="h-3.5 w-3.5" />
              Organizer Check-In Desk
            </button>
          </div>
        )}
      </div>

      {effectiveMode === 'scanner' ? (
        <OrganizerScanner />
      ) : (
        <AttendeePassCard />
      )}
    </div>
  );
}
