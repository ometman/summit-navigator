'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Check,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Heart,
  Loader2,
  Mail,
  Play,
  Settings,
  Share2,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PresentationPlayerModal } from '@/components/footer/presentation-player-modal';
import { useAuth, useFirestore, useUser } from '@/firebase';
import {
  getVerifiedUserProfile,
  saveVerifiedUserProfile,
} from '@/firebase/user-profile';
import { useSummitContent } from '@/components/content/summit-content-provider';
import { type Session } from '@/lib/data';
import {
  DEFAULT_FOOTER_SETTINGS,
  INITIAL_ENGAGEMENT_STATE,
  SUMMIT_ENGAGEMENT_KEY,
  SUMMIT_SETTINGS_KEY,
  buildFullSummitPackContent,
  buildScheduleCsv,
  buildSessionGuideContent,
  triggerFileDownload,
  type DownloadFormat,
  type EngagementState,
  type PlaybackSpeed,
  type UserFooterSettings,
} from '@/lib/presentation-data';
import type { RegistrationTrack } from '@/lib/registrations';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const MINISTRY_ROLES = [
  'Senior Pastor',
  'Ministry Lead',
  'Operations & Strategy',
  'Youth & Outreach',
  'Volunteer Coordinator',
] as const;

const SESSION_TRACKS: RegistrationTrack[] = [
  'Morning & Afternoon',
  'Morning Track',
  'Afternoon Track',
];

export function TikTokFooter() {
  const pathname = usePathname();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isMfaVerified } = useUser();

  const {
    sessions,
    speakers,
    slidesBySessionId,
    studyPacketsBySessionId,
  } = useSummitContent();

  // Detect active session from URL `/session/[id]`
  const activeSessionId = useMemo(() => {
    const match = pathname?.match(/^\/session\/(\d+)/);
    if (!match) return undefined;
    const parsed = parseInt(match[1], 10);
    return sessions.some((s) => s.id === parsed) ? parsed : undefined;
  }, [pathname, sessions]);

  const activeSession: Session = useMemo(
    () =>
      sessions.find((s) => s.id === activeSessionId) || sessions[0],
    [activeSessionId, sessions]
  );

  const likeTargetId = activeSessionId
    ? `session-${activeSessionId}`
    : 'summit-overview';

  // Persistent local engagement & settings
  const [engagement, setEngagement] = useState<EngagementState>(
    INITIAL_ENGAGEMENT_STATE
  );
  const [settings, setSettings] = useState<UserFooterSettings>(
    DEFAULT_FOOTER_SETTINGS
  );
  const [selectedDownloadSessionId, setSelectedDownloadSessionId] =
    useState<number>(activeSessionId ?? 1);

  // Modal states
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'link' | 'summary' | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');

  // Authenticated Firestore profile state (for User Settings)
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileFullName, setProfileFullName] = useState('');
  const [profileOrg, setProfileOrg] = useState('');
  const [profileRole, setProfileRole] = useState<string>('Ministry Lead');
  const [profileTrack, setProfileTrack] =
    useState<RegistrationTrack>('Morning & Afternoon');

  useEffect(() => {
    if (activeSessionId) {
      setSelectedDownloadSessionId(activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
    }
  }, [pathname, shareOpen]);

  useEffect(() => {
    try {
      const savedEngagement = localStorage.getItem(SUMMIT_ENGAGEMENT_KEY);
      if (savedEngagement) {
        const parsed = JSON.parse(savedEngagement) as EngagementState;
        setEngagement({
          likedIds: Array.isArray(parsed.likedIds) ? parsed.likedIds : [],
          likeCounts: {
            ...INITIAL_ENGAGEMENT_STATE.likeCounts,
            ...(parsed.likeCounts || {}),
          },
          shareCount:
            typeof parsed.shareCount === 'number'
              ? parsed.shareCount
              : INITIAL_ENGAGEMENT_STATE.shareCount,
        });
      }

      const savedSettings = localStorage.getItem(SUMMIT_SETTINGS_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings) as Partial<UserFooterSettings>;
        setSettings({
          defaultDownloadFormat:
            parsed.defaultDownloadFormat === 'txt' ||
            parsed.defaultDownloadFormat === 'json'
              ? parsed.defaultDownloadFormat
              : 'md',
          showCaptions:
            typeof parsed.showCaptions === 'boolean'
              ? parsed.showCaptions
              : true,
          playbackSpeed:
            parsed.playbackSpeed === 1.25 || parsed.playbackSpeed === 1.5
              ? parsed.playbackSpeed
              : 1,
          autoAdvanceSlides:
            typeof parsed.autoAdvanceSlides === 'boolean'
              ? parsed.autoAdvanceSlides
              : true,
        });
      }
    } catch {
      // Ignore storage parsing errors
    }
  }, []);

  const persistEngagement = useCallback((next: EngagementState) => {
    setEngagement(next);
    try {
      localStorage.setItem(SUMMIT_ENGAGEMENT_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const updateSettings = useCallback((patch: Partial<UserFooterSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SUMMIT_SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  }, []);

  const isFullyVerified = Boolean(user && !user.isAnonymous && isMfaVerified);

  // Load Firestore profile when Settings modal opens for an authenticated verified user
  useEffect(() => {
    if (!settingsOpen || !isFullyVerified || !firestore || !user) return;
    let cancelled = false;

    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const existing = await getVerifiedUserProfile(firestore, auth, user.uid);
        if (cancelled) return;
        if (existing) {
          setProfileFullName(existing.fullName || user.displayName || '');
          setProfileOrg(existing.organization || '');
          setProfileRole(existing.role || 'Ministry Lead');
          setProfileTrack(existing.track || 'Morning & Afternoon');
        } else {
          setProfileFullName(user.displayName || '');
          setProfileOrg('');
          setProfileRole('Ministry Lead');
          setProfileTrack('Morning & Afternoon');
        }
      } catch {
        if (!cancelled) {
          setProfileError('Unable to load your Firestore profile right now.');
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [settingsOpen, isFullyVerified, firestore, auth, user]);

  const handleToggleLike = useCallback(
    (targetId: string) => {
      const currentlyLiked = engagement.likedIds.includes(targetId);
      const currentCount =
        engagement.likeCounts[targetId] ??
        INITIAL_ENGAGEMENT_STATE.likeCounts[targetId] ??
        50;

      const nextLikedIds = currentlyLiked
        ? engagement.likedIds.filter((id) => id !== targetId)
        : [...engagement.likedIds, targetId];

      const nextCounts = {
        ...engagement.likeCounts,
        [targetId]: Math.max(0, currentCount + (currentlyLiked ? -1 : 1)),
      };

      persistEngagement({
        ...engagement,
        likedIds: nextLikedIds,
        likeCounts: nextCounts,
      });
    },
    [engagement, persistEngagement]
  );

  const incrementShareCount = useCallback(() => {
    persistEngagement({
      ...engagement,
      shareCount: engagement.shareCount + 1,
    });
  }, [engagement, persistEngagement]);

  const handleShareTrigger = async () => {
    const shareUrl =
      typeof window !== 'undefined' ? window.location.href : '';
    const shareTitle = activeSessionId
      ? `Summit Navigator · ${activeSession.title}`
      : 'Summit Navigator · Leadership Training Dashboard';
    const shareText = activeSessionId
      ? `${activeSession.title} by ${activeSession.speaker} (${activeSession.time})`
      : 'Explore the Summit Navigator agenda, speakers, and live session briefs.';

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        incrementShareCount();
        toast({
          title: 'Shared successfully',
          description: 'Summit content link shared.',
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    setCopiedKey(null);
    setShareOpen(true);
  };

  const handleCopyShare = async (type: 'link' | 'summary') => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    const text =
      type === 'link'
        ? url
        : `${
            activeSessionId
              ? `${activeSession.title} — ${activeSession.speaker} (${activeSession.time})\n${activeSession.summary}`
              : 'Summit Navigator — Preparing the Workforce for Growth and Impact (9:00 AM - 3:45 PM)'
          }\n${url}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(type);
      incrementShareCount();
      toast({
        title: type === 'link' ? 'Link copied' : 'Summary copied',
        description: 'Ready to paste and share.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Clipboard unavailable',
        description: 'Please copy the URL from your browser address bar.',
      });
    }
  };

  const handleDownloadSessionBrief = () => {
    const targetSession =
      sessions.find((s) => s.id === selectedDownloadSessionId) ||
      activeSession;
    const file = buildSessionGuideContent(
      targetSession,
      settings.defaultDownloadFormat,
      slidesBySessionId[targetSession.id],
      studyPacketsBySessionId[targetSession.id]
    );
    triggerFileDownload(file.filename, file.content, file.mimeType);
    toast({
      title: 'Session content downloaded',
      description: `Saved ${file.filename}`,
    });
  };

  const handleDownloadFullPack = () => {
    const file = buildFullSummitPackContent(
      settings.defaultDownloadFormat,
      sessions,
      speakers,
      slidesBySessionId,
      studyPacketsBySessionId
    );
    triggerFileDownload(file.filename, file.content, file.mimeType);
    toast({
      title: 'Full summit pack downloaded',
      description: `Saved ${file.filename}`,
    });
  };

  const handleDownloadCsv = () => {
    const file = buildScheduleCsv(sessions);
    triggerFileDownload(file.filename, file.content, file.mimeType);
    toast({
      title: 'Schedule CSV downloaded',
      description: `Saved ${file.filename}`,
    });
  };

  const handleSaveFirestoreProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !user.email) return;

    if (profileFullName.trim().length < 2) {
      setProfileError('Full name must be at least 2 characters.');
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    try {
      await saveVerifiedUserProfile(firestore, auth, {
        uid: user.uid,
        fullName: profileFullName.trim(),
        email: user.email,
        organization: profileOrg.trim() || 'Summit Attendee',
        role: profileRole,
        track: profileTrack,
        mfaVerifiedAt: new Date().toISOString(),
      });
      toast({
        title: 'Settings saved',
        description: 'Your profile and preferences have been updated.',
      });
    } catch {
      setProfileError('Could not save your profile to Firestore. Please retry.');
    } finally {
      setProfileSaving(false);
    }
  };

  const isLiked = engagement.likedIds.includes(likeTargetId);
  const currentLikes =
    engagement.likeCounts[likeTargetId] ??
    INITIAL_ENGAGEMENT_STATE.likeCounts[likeTargetId] ??
    142;

  const shareSubject = encodeURIComponent(
    activeSessionId
      ? `Summit Navigator: ${activeSession.title}`
      : 'Summit Navigator Leadership Summit'
  );
  const shareBody = encodeURIComponent(
    `${
      activeSessionId
        ? `${activeSession.title} with ${activeSession.speaker} (${activeSession.time})`
        : 'Explore the Summit Navigator agenda and presentations'
    }: ${currentUrl}`
  );

  return (
    <>
      <footer
        aria-label="Quick presentation and content actions"
        className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-zinc-950/95 text-zinc-100 backdrop-blur-md border-t border-white/10"
      >
        <div className="max-w-3xl mx-auto h-full px-2 sm:px-4 grid grid-cols-5 items-center gap-1">
          {/* 1. Download Content */}
          <button
            type="button"
            onClick={() => setDownloadOpen(true)}
            className="flex flex-col items-center justify-center min-h-[44px] rounded-lg text-zinc-300 hover:text-white hover:bg-white/5 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Download className="h-5 w-5" />
            <span className="text-[11px] font-medium leading-tight mt-0.5 whitespace-nowrap">
              Download
            </span>
          </button>

          {/* 2. Like */}
          <button
            type="button"
            onClick={() => handleToggleLike(likeTargetId)}
            aria-pressed={isLiked}
            className={cn(
              'flex flex-col items-center justify-center min-h-[44px] rounded-lg hover:bg-white/5 active:scale-90 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
              isLiked ? 'text-[#FE2C55]' : 'text-zinc-300 hover:text-white'
            )}
          >
            <Heart
              className={cn(
                'h-5 w-5 transition-transform duration-150',
                isLiked && 'fill-[#FE2C55] scale-110'
              )}
            />
            <span className="text-[11px] font-medium leading-tight mt-0.5 tabular-nums whitespace-nowrap">
              {currentLikes}
            </span>
          </button>

          {/* 3. Watch Presentation Video (Center TikTok-styled icon button) */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setWatchOpen(true)}
              aria-label="Watch presentation video"
              title="Watch presentation video"
              className="group flex items-center justify-center min-h-[44px] min-w-[52px] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <span className="flex items-center justify-center w-12 h-8 rounded-lg bg-white text-zinc-950 shadow-[-3.5px_0_0_#25F4EE,3.5px_0_0_#FE2C55] group-hover:brightness-95 group-active:scale-95 transition-all duration-150">
                <Play className="h-4 w-4 fill-zinc-950 translate-x-[1px]" aria-hidden="true" />
              </span>
            </button>
          </div>

          {/* 4. Share */}
          <button
            type="button"
            onClick={handleShareTrigger}
            className="flex flex-col items-center justify-center min-h-[44px] rounded-lg text-zinc-300 hover:text-white hover:bg-white/5 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Share2 className="h-5 w-5" />
            <span className="text-[11px] font-medium leading-tight mt-0.5 tabular-nums whitespace-nowrap">
              {engagement.shareCount}
            </span>
          </button>

          {/* 5. User Settings */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex flex-col items-center justify-center min-h-[44px] rounded-lg text-zinc-300 hover:text-white hover:bg-white/5 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Settings className="h-5 w-5" />
            <span className="text-[11px] font-medium leading-tight mt-0.5 whitespace-nowrap">
              Settings
            </span>
          </button>
        </div>
      </footer>

      {/* Download Content Dialog */}
      <Dialog open={downloadOpen} onOpenChange={setDownloadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Download Summit Content</DialogTitle>
            <DialogDescription>
              Export session study guides, full speaker materials, or the schedule spreadsheet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="download-session-select">Session Guide</Label>
                <Select
                  value={String(selectedDownloadSessionId)}
                  onValueChange={(v) => setSelectedDownloadSessionId(Number(v))}
                >
                  <SelectTrigger id="download-session-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        Session {s.id}: {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="download-format-select">File Format</Label>
                <Select
                  value={settings.defaultDownloadFormat}
                  onValueChange={(v) =>
                    updateSettings({
                      defaultDownloadFormat: v as DownloadFormat,
                    })
                  }
                >
                  <SelectTrigger id="download-format-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="md">Markdown (.md)</SelectItem>
                    <SelectItem value="txt">Plain Text (.txt)</SelectItem>
                    <SelectItem value="json">Structured Data (.json)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleDownloadSessionBrief}
                className="w-full flex items-center justify-between p-3.5 rounded-lg border border-border hover:bg-muted/50 text-left transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      Session {selectedDownloadSessionId} Study Brief
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      Overview, speaker takeaways, and prayer notes (.{settings.defaultDownloadFormat})
                    </p>
                  </div>
                </div>
                <Download className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
              </button>

              <button
                type="button"
                onClick={handleDownloadFullPack}
                className="w-full flex items-center justify-between p-3.5 rounded-lg border border-border hover:bg-muted/50 text-left transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileJson className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      Complete Summit Program Pack
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      All 6 sessions, speaker bios, and slide takeaways (.{settings.defaultDownloadFormat})
                    </p>
                  </div>
                </div>
                <Download className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
              </button>

              <button
                type="button"
                onClick={handleDownloadCsv}
                className="w-full flex items-center justify-between p-3.5 rounded-lg border border-border hover:bg-muted/50 text-left transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      Full Summit Schedule Spreadsheet
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      Session times, speakers, and minute allocations (.csv)
                    </p>
                  </div>
                </div>
                <Download className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Watch Presentation Video Modal */}
      <PresentationPlayerModal
        open={watchOpen}
        onOpenChange={setWatchOpen}
        initialSessionId={activeSessionId ?? 1}
        settings={settings}
        likedSessionIds={engagement.likedIds}
        likeCounts={engagement.likeCounts}
        onToggleLike={handleToggleLike}
        onNotify={(title, description) => toast({ title, description })}
      />

      {/* Share Content Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Summit Content</DialogTitle>
            <DialogDescription>
              Share {activeSessionId ? `Session ${activeSession.id}: ${activeSession.title}` : 'Summit Navigator'} with your ministry team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={currentUrl}
                aria-label="Shareable URL"
                className="text-xs font-mono"
              />
              <Button
                type="button"
                onClick={() => handleCopyShare('link')}
                className="whitespace-nowrap shrink-0"
              >
                {copiedKey === 'link' ? (
                  <>
                    <Check className="h-4 w-4 mr-1.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1.5" /> Copy
                  </>
                )}
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => handleCopyShare('summary')}
              className="w-full justify-start"
            >
              {copiedKey === 'summary' ? (
                <Check className="h-4 w-4 mr-2 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Copy Formatted Summary &amp; Link
            </Button>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button asChild variant="outline">
                <a
                  href={`mailto:?subject=${shareSubject}&body=${shareBody}`}
                  onClick={incrementShareCount}
                >
                  <Mail className="h-4 w-4 mr-2" /> Email
                </a>
              </Button>
              <Button asChild variant="outline">
                <a
                  href={`https://wa.me/?text=${shareBody}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={incrementShareCount}
                >
                  <Share2 className="h-4 w-4 mr-2" /> WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Settings</DialogTitle>
            <DialogDescription>
              Customize presentation playback, download format, and your verified attendee profile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-1">
            {/* Playback & Content Preferences */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1.5">
                Content &amp; Presentation Preferences
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="settings-download-format">
                    Default Download Format
                  </Label>
                  <Select
                    value={settings.defaultDownloadFormat}
                    onValueChange={(v) =>
                      updateSettings({
                        defaultDownloadFormat: v as DownloadFormat,
                      })
                    }
                  >
                    <SelectTrigger id="settings-download-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="md">Markdown (.md)</SelectItem>
                      <SelectItem value="txt">Plain Text (.txt)</SelectItem>
                      <SelectItem value="json">JSON (.json)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="settings-playback-speed">
                    Video Playback Speed
                  </Label>
                  <Select
                    value={String(settings.playbackSpeed)}
                    onValueChange={(v) =>
                      updateSettings({
                        playbackSpeed: Number(v) as PlaybackSpeed,
                      })
                    }
                  >
                    <SelectTrigger id="settings-playback-speed">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1.0x (Standard)</SelectItem>
                      <SelectItem value="1.25">1.25x (Fast)</SelectItem>
                      <SelectItem value="1.5">1.5x (Express)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 py-1">
                <div>
                  <Label htmlFor="settings-captions" className="text-sm">
                    Show Presentation Captions
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Display synchronized key speaker takeaways over slides.
                  </p>
                </div>
                <Switch
                  id="settings-captions"
                  checked={settings.showCaptions}
                  onCheckedChange={(checked) =>
                    updateSettings({ showCaptions: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-4 py-1">
                <div>
                  <Label htmlFor="settings-autoadvance" className="text-sm">
                    Auto-Advance Sessions
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Continue automatically to the next session when a video finishes.
                  </p>
                </div>
                <Switch
                  id="settings-autoadvance"
                  checked={settings.autoAdvanceSlides}
                  onCheckedChange={(checked) =>
                    updateSettings({ autoAdvanceSlides: checked })
                  }
                />
              </div>
            </div>

            {/* Verified Account & Firestore Profile */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground border-b pb-1.5">
                Attendee Account
              </h3>

              {isFullyVerified && user ? (
                profileLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading your attendee profile...
                  </div>
                ) : (
                  <form
                    onSubmit={handleSaveFirestoreProfile}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate">
                        Verified Google + Email OTP: {user.email}
                      </span>
                    </div>

                    {profileError && (
                      <p className="text-xs text-destructive">{profileError}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="profile-fullname">Full Name</Label>
                        <Input
                          id="profile-fullname"
                          value={profileFullName}
                          onChange={(e) => setProfileFullName(e.target.value)}
                          maxLength={120}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="profile-org">Organization</Label>
                        <Input
                          id="profile-org"
                          value={profileOrg}
                          onChange={(e) => setProfileOrg(e.target.value)}
                          maxLength={150}
                          placeholder="Grace Community Church"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="profile-role">Ministry Role</Label>
                        <Select
                          value={profileRole}
                          onValueChange={setProfileRole}
                        >
                          <SelectTrigger id="profile-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MINISTRY_ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="profile-track">Session Track</Label>
                        <Select
                          value={profileTrack}
                          onValueChange={(v) =>
                            setProfileTrack(v as RegistrationTrack)
                          }
                        >
                          <SelectTrigger id="profile-track">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SESSION_TRACKS.map((track) => (
                              <SelectItem key={track} value={track}>
                                {track}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button type="submit" disabled={profileSaving}>
                        {profileSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Profile Settings'
                        )}
                      </Button>
                    </div>
                  </form>
                )
              ) : user && !user.isAnonymous ? (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <p className="text-sm text-foreground font-medium">
                    Email OTP verification required
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You signed in with Google ({user.email}). Complete the 6-digit email code verification to sync and manage your profile settings.
                  </p>
                  <Button asChild size="sm" onClick={() => setSettingsOpen(false)}>
                    <Link href="/login">
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Verify Email OTP
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <p className="text-sm text-foreground font-medium">
                    Sign in to sync your profile
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Playback and download preferences are saved on this device. Sign in with Google and Email OTP MFA to manage your attendee profile across sessions.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" onClick={() => setSettingsOpen(false)}>
                      <Link href="/login">
                        <User className="h-4 w-4 mr-2" />
                        Sign In with Google
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      onClick={() => setSettingsOpen(false)}
                    >
                      <Link href="/register">Register</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
