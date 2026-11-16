'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Captions,
  Download,
  Heart,
  Maximize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSummitContent } from '@/components/content/summit-content-provider';
import { type Session } from '@/lib/data';
import {
  buildSessionGuideContent,
  getSlidesForSession,
  triggerFileDownload,
  type PlaybackSpeed,
  type UserFooterSettings,
} from '@/lib/presentation-data';
import { cn } from '@/lib/utils';

interface PresentationPlayerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSessionId?: number;
  settings: UserFooterSettings;
  likedSessionIds: string[];
  likeCounts: Record<string, number>;
  onToggleLike: (targetId: string) => void;
  onNotify: (title: string, description: string) => void;
}

const SLIDE_DURATION_SEC = 18;

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function PresentationPlayerModal({
  open,
  onOpenChange,
  initialSessionId = 1,
  settings,
  likedSessionIds,
  likeCounts,
  onToggleLike,
  onNotify,
}: PresentationPlayerModalProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<number>(initialSessionId);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [speed, setSpeed] = useState<PlaybackSpeed>(settings.playbackSpeed);
  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(settings.showCaptions);
  const [narrationEnabled, setNarrationEnabled] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const lastSpokenSlideKeyRef = useRef<string>('');

  const { sessions, slidesBySessionId, studyPacketsBySessionId } = useSummitContent();

  const session: Session = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || sessions[0],
    [selectedSessionId, sessions]
  );
  const slides = useMemo(
    () => getSlidesForSession(session, slidesBySessionId[session.id]),
    [session, slidesBySessionId]
  );
  const totalDurationSec = slides.length * SLIDE_DURATION_SEC;

  const currentSlideIndex = Math.min(
    slides.length - 1,
    Math.floor(elapsedSec / SLIDE_DURATION_SEC)
  );
  const currentSlide = slides[currentSlideIndex];
  const slideElapsed = elapsedSec - currentSlideIndex * SLIDE_DURATION_SEC;

  useEffect(() => {
    if (open) {
      setSelectedSessionId(initialSessionId);
      setElapsedSec(0);
      setIsPlaying(true);
      setSpeed(settings.playbackSpeed);
      setCaptionsEnabled(settings.showCaptions);
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      lastSpokenSlideKeyRef.current = '';
    }
  }, [open, initialSessionId, settings.playbackSpeed, settings.showCaptions]);

  const selectSession = useCallback((sessionId: number) => {
    setSelectedSessionId(sessionId);
    setElapsedSec(0);
    setIsPlaying(true);
    lastSpokenSlideKeyRef.current = '';
  }, []);

  // Playback timer
  useEffect(() => {
    if (!open || !isPlaying) return;

    let lastTick = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.25, (now - lastTick) / 1000);
      lastTick = now;

      setElapsedSec((prev) => {
        const next = prev + dt * speed;
        if (next >= totalDurationSec) {
          if (settings.autoAdvanceSlides) {
            const nextSessionIndex =
              sessions.findIndex((s) => s.id === session.id) + 1;
            if (nextSessionIndex < sessions.length) {
              setSelectedSessionId(sessions[nextSessionIndex].id);
              lastSpokenSlideKeyRef.current = '';
              return 0;
            }
          }
          setIsPlaying(false);
          return totalDurationSec;
        }
        return next;
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [open, isPlaying, speed, totalDurationSec, settings.autoAdvanceSlides, session.id, sessions]);

  // Optional speech synthesis narration
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (!open || !isPlaying || !narrationEnabled) {
      window.speechSynthesis.cancel();
      if (!narrationEnabled) lastSpokenSlideKeyRef.current = '';
      return;
    }

    const slideKey = `${session.id}-${currentSlideIndex}`;
    if (lastSpokenSlideKeyRef.current === slideKey) return;
    lastSpokenSlideKeyRef.current = slideKey;

    window.speechSynthesis.cancel();
    const script = `${currentSlide.heading}. ${currentSlide.bullets.join(' ')}`;
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = speed;
    window.speechSynthesis.speak(utterance);

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [open, isPlaying, narrationEnabled, session.id, currentSlideIndex, currentSlide, speed]);

  // Render interactive 16:9 presentation video frame to canvas
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 960;
    const height = 540;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background dark keynote canvas
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#09090b');
    grad.addColorStop(0.55, '#111827');
    grad.addColorStop(1, '#09090b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle geometric accent glow (restrained, high contrast)
    const accentGlow = ctx.createRadialGradient(width - 140, 110, 20, width - 140, 110, 340);
    accentGlow.addColorStop(0, `${currentSlide.accentHex}38`);
    accentGlow.addColorStop(1, 'rgba(9,9,11,0)');
    ctx.fillStyle = accentGlow;
    ctx.fillRect(0, 0, width, height);

    // Top metadata line
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '600 15px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `SUMMIT NAVIGATOR  ·  SESSION ${session.id} OF ${sessions.length}  ·  ${session.time}`,
      56,
      58
    );

    // Subtle hairline divider
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(56, 78);
    ctx.lineTo(width - 56, 78);
    ctx.stroke();

    // Slide Heading
    ctx.fillStyle = '#fafafa';
    ctx.font = '700 36px system-ui, -apple-system, sans-serif';
    const headingLines = wrapCanvasText(ctx, currentSlide.heading, width - 112);
    let y = 132;
    for (const line of headingLines) {
      ctx.fillText(line, 56, y);
      y += 44;
    }

    // Subheading
    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 18px system-ui, -apple-system, sans-serif';
    ctx.fillText(currentSlide.subheading, 56, y + 6);
    y += 48;

    // Animated bullets (staggered reveal within slide duration)
    currentSlide.bullets.forEach((bullet, index) => {
      const revealStart = index * 1.4;
      const alpha = Math.min(1, Math.max(0.22, (slideElapsed - revealStart + 0.8) / 0.8));

      ctx.save();
      ctx.globalAlpha = alpha;

      // Bullet marker
      ctx.fillStyle = '#FE2C55';
      ctx.beginPath();
      ctx.arc(68, y - 6, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e4e4e7';
      ctx.font = '400 20px system-ui, -apple-system, sans-serif';
      const lines = wrapCanvasText(ctx, bullet, width - 150);
      lines.forEach((line) => {
        ctx.fillText(line, 90, y);
        y += 30;
      });
      y += 14;
      ctx.restore();
    });

    // Subtle audio/timeline equalizer bars in bottom-right corner
    const barCount = 12;
    const baseX = width - 180;
    const baseY = height - 42;
    for (let i = 0; i < barCount; i++) {
      const wave = isPlaying
        ? 0.35 + 0.65 * Math.abs(Math.sin(elapsedSec * 4.5 + i * 0.7))
        : 0.25;
      const barHeight = Math.round(6 + wave * 18);
      ctx.fillStyle = i % 2 === 0 ? '#25F4EE' : '#FE2C55';
      ctx.globalAlpha = isPlaying ? 0.85 : 0.35;
      ctx.fillRect(baseX + i * 10, baseY - barHeight, 5, barHeight);
    }
    ctx.globalAlpha = 1;

    // Slide progress indicator on bottom-left
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 14px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(
      `SLIDE ${currentSlideIndex + 1}/${slides.length}`,
      56,
      height - 38
    );
  }, [
    open,
    session,
    currentSlide,
    currentSlideIndex,
    slides.length,
    slideElapsed,
    elapsedSec,
    isPlaying,
    sessions.length,
  ]);

  const handleTogglePlay = () => {
    if (elapsedSec >= totalDurationSec) {
      setElapsedSec(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handlePrevSlide = () => {
    const targetSlide = Math.max(0, currentSlideIndex - 1);
    setElapsedSec(targetSlide * SLIDE_DURATION_SEC);
    lastSpokenSlideKeyRef.current = '';
  };

  const handleNextSlide = () => {
    const targetSlide = Math.min(slides.length - 1, currentSlideIndex + 1);
    setElapsedSec(targetSlide * SLIDE_DURATION_SEC);
    lastSpokenSlideKeyRef.current = '';
  };

  const handleCycleSpeed = () => {
    const order: PlaybackSpeed[] = [1, 1.25, 1.5];
    const next = order[(order.indexOf(speed) + 1) % order.length];
    setSpeed(next);
  };

  const handleFullscreen = async () => {
    if (!stageRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await stageRef.current.requestFullscreen();
      }
    } catch {
      // Fullscreen may be restricted by iframe permissions
    }
  };

  const handleDownloadCurrentDeck = () => {
    const file = buildSessionGuideContent(
      session,
      settings.defaultDownloadFormat,
      slidesBySessionId[session.id],
      studyPacketsBySessionId[session.id]
    );
    triggerFileDownload(file.filename, file.content, file.mimeType);
    onNotify('Presentation brief downloaded', `Saved ${file.filename}`);
  };

  const likeKey = `session-${session.id}`;
  const isLiked = likedSessionIds.includes(likeKey);
  const likeCount = likeCounts[likeKey] ?? 60;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-zinc-950 text-zinc-100 border-zinc-800 p-4 sm:p-6">
        <DialogHeader className="text-left space-y-1">
          <DialogTitle className="text-lg sm:text-xl font-bold text-white pr-8">
            Watch Presentation: {session.title}
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs sm:text-sm">
            {session.speaker} · {session.time} · Interactive Keynote Playback
          </DialogDescription>
        </DialogHeader>

        {/* Session Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {sessions.map((item) => {
            const active = item.id === session.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSession(item.id)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors min-h-[36px]',
                  active
                    ? 'bg-white text-zinc-950'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                )}
              >
                Session {item.id}
              </button>
            );
          })}
        </div>

        {/* Video Stage */}
        <div
          ref={stageRef}
          className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-zinc-800"
        >
          <canvas
            ref={canvasRef}
            onClick={handleTogglePlay}
            className="w-full h-full block cursor-pointer"
          />

          {captionsEnabled && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pt-8 pb-3 text-center">
              <p className="inline-block rounded bg-black/70 px-3 py-1 text-xs sm:text-sm text-white leading-snug">
                {currentSlide.caption}
              </p>
            </div>
          )}
        </div>

        {/* Timeline & Controls */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono tabular-nums text-zinc-400 w-11">
              {formatTime(elapsedSec)}
            </span>
            <input
              type="range"
              aria-label="Presentation timeline"
              min={0}
              max={totalDurationSec}
              step={0.5}
              value={Math.min(elapsedSec, totalDurationSec)}
              onChange={(e) => {
                setElapsedSec(Number(e.target.value));
                lastSpokenSlideKeyRef.current = '';
              }}
              className="flex-1 accent-[#FE2C55] cursor-pointer h-1.5"
            />
            <span className="text-xs font-mono tabular-nums text-zinc-400 w-11 text-right">
              {formatTime(totalDurationSec)}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handlePrevSlide}
                disabled={currentSlideIndex === 0}
                className="text-zinc-200 hover:text-white hover:bg-zinc-800 h-10 w-10"
                title="Previous slide"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                onClick={handleTogglePlay}
                className="bg-[#FE2C55] hover:bg-[#e52349] text-white h-10 px-4 whitespace-nowrap"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4 mr-1.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1.5" /> Play
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handleNextSlide}
                disabled={currentSlideIndex >= slides.length - 1}
                className="text-zinc-200 hover:text-white hover:bg-zinc-800 h-10 w-10"
                title="Next slide"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleCycleSpeed}
                className="text-zinc-200 hover:text-white hover:bg-zinc-800 font-mono tabular-nums h-9 px-2.5"
                title="Playback speed"
              >
                {speed}x
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setCaptionsEnabled((v) => !v)}
                className={cn(
                  'h-9 w-9 hover:bg-zinc-800',
                  captionsEnabled ? 'text-[#25F4EE]' : 'text-zinc-400'
                )}
                title={captionsEnabled ? 'Hide captions' : 'Show captions'}
              >
                <Captions className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setNarrationEnabled((v) => !v)}
                className={cn(
                  'h-9 w-9 hover:bg-zinc-800',
                  narrationEnabled ? 'text-[#25F4EE]' : 'text-zinc-400'
                )}
                title={narrationEnabled ? 'Mute voice narration' : 'Enable voice narration'}
              >
                {narrationEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onToggleLike(likeKey)}
                className={cn(
                  'h-9 px-2.5 hover:bg-zinc-800 tabular-nums',
                  isLiked ? 'text-[#FE2C55]' : 'text-zinc-300'
                )}
              >
                <Heart className={cn('h-4 w-4 mr-1.5', isLiked && 'fill-current')} />
                {likeCount}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleDownloadCurrentDeck}
                className="h-9 px-3 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 whitespace-nowrap"
              >
                <Download className="h-4 w-4 mr-1.5" />
                Save Brief
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handleFullscreen}
                className="text-zinc-400 hover:text-white hover:bg-zinc-800 h-9 w-9 hidden sm:inline-flex"
                title="Toggle fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
