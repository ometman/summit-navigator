'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useFirebase } from '@/firebase';
import {
  speakerNameToKey,
  subscribeToSessionOverrides,
  subscribeToSpeakerOverrides,
  type SessionOverrideRecord,
  type SpeakerOverrideRecord,
} from '@/firebase/admin-content';
import { agendaData, speakerData, type Session, type Speaker } from '@/lib/data';
import {
  getDefaultStudyPacket,
  getSlidesForSession,
  type PresentationSlide,
  type SessionStudyPacket,
} from '@/lib/presentation-data';

export interface SummitContentContextValue {
  sessions: Session[];
  speakers: Speaker[];
  sessionOverrides: Record<number, SessionOverrideRecord>;
  speakerOverrides: Record<string, SpeakerOverrideRecord>;
  slidesBySessionId: Record<number, PresentationSlide[]>;
  studyPacketsBySessionId: Record<number, SessionStudyPacket>;
  isOverridesLoading: boolean;
  getEffectiveSession: (sessionId: number) => Session | undefined;
  getEffectiveSpeaker: (name: string) => Speaker | undefined;
}

const SummitContentContext = createContext<SummitContentContextValue>({
  sessions: agendaData,
  speakers: speakerData,
  sessionOverrides: {},
  speakerOverrides: {},
  slidesBySessionId: {},
  studyPacketsBySessionId: {},
  isOverridesLoading: false,
  getEffectiveSession: (id) => agendaData.find((s) => s.id === id),
  getEffectiveSpeaker: (name) => speakerData.find((sp) => sp.name === name),
});

export function SummitContentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { firestore, auth } = useFirebase();
  const [sessionOverrides, setSessionOverrides] = useState<
    Record<number, SessionOverrideRecord>
  >({});
  const [speakerOverrides, setSpeakerOverrides] = useState<
    Record<string, SpeakerOverrideRecord>
  >({});
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [speakersLoaded, setSpeakersLoaded] = useState(false);

  useEffect(() => {
    if (!firestore) {
      setSessionsLoaded(true);
      setSpeakersLoaded(true);
      return;
    }

    const unsubSessions = subscribeToSessionOverrides(
      firestore,
      auth,
      (map) => {
        setSessionOverrides(map);
        setSessionsLoaded(true);
      },
      () => {
        setSessionsLoaded(true);
      }
    );

    const unsubSpeakers = subscribeToSpeakerOverrides(
      firestore,
      auth,
      (map) => {
        setSpeakerOverrides(map);
        setSpeakersLoaded(true);
      },
      () => {
        setSpeakersLoaded(true);
      }
    );

    return () => {
      unsubSessions();
      unsubSpeakers();
    };
  }, [firestore, auth]);

  const value = useMemo<SummitContentContextValue>(() => {
    const sessions: Session[] = agendaData.map((base) => {
      const ov = sessionOverrides[base.id];
      if (!ov) return base;
      return {
        ...base,
        time: ov.time || base.time,
        title: ov.title || base.title,
        speaker: ov.speaker || base.speaker,
        content: typeof ov.content === 'number' ? ov.content : base.content,
        qa: typeof ov.qa === 'number' ? ov.qa : base.qa,
        prayer: typeof ov.prayer === 'number' ? ov.prayer : base.prayer,
        summary: ov.summary || base.summary,
      };
    });

    const speakers: Speaker[] = speakerData.map((base) => {
      const key = speakerNameToKey(base.name);
      const ov = speakerOverrides[key];
      if (!ov) return base;
      return {
        ...base,
        role: ov.role || base.role,
        bio: ov.bio || base.bio,
      };
    });

    const slidesBySessionId: Record<number, PresentationSlide[]> = {};
    const studyPacketsBySessionId: Record<number, SessionStudyPacket> = {};

    for (const session of sessions) {
      const ov = sessionOverrides[session.id];
      slidesBySessionId[session.id] = getSlidesForSession(session, ov?.slides);
      studyPacketsBySessionId[session.id] = ov
        ? {
            title: ov.studyPacketTitle || getDefaultStudyPacket(session).title,
            notes: ov.studyPacketNotes,
          }
        : getDefaultStudyPacket(session);
    }

    return {
      sessions,
      speakers,
      sessionOverrides,
      speakerOverrides,
      slidesBySessionId,
      studyPacketsBySessionId,
      isOverridesLoading: !(sessionsLoaded && speakersLoaded),
      getEffectiveSession: (id: number) => sessions.find((s) => s.id === id),
      getEffectiveSpeaker: (name: string) =>
        speakers.find((sp) => sp.name === name),
    };
  }, [sessionOverrides, speakerOverrides, sessionsLoaded, speakersLoaded]);

  return (
    <SummitContentContext.Provider value={value}>
      {children}
    </SummitContentContext.Provider>
  );
}

export function useSummitContent(): SummitContentContextValue {
  return useContext(SummitContentContext);
}
