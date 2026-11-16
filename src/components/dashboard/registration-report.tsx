'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format, subDays, subHours, isAfter, parseISO } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Download,
  Plus,
  QrCode,
  Search,
  SlidersHorizontal,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import { isBootstrappedAdminUser } from '@/firebase/qa';
import {
  subscribeToFirestoreRegistrations,
  type FirestoreRegistrationRecord,
} from '@/firebase/admin-content';
import {
  checkInPassByOrganizer,
  revertPassCheckInByOrganizer,
  subscribeToAllAttendeePasses,
  type AttendeePassRecord,
} from '@/firebase/passes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useToast } from '@/hooks/use-toast';
import {
  REGISTRATIONS_STORAGE_KEY,
  initialRegistrations,
  mergeRegistrations,
  registrationsToCsv,
  type RegistrationSource,
  type RegistrationStatus,
  type RegistrationTrack,
  type UserRegistration,
} from '@/lib/registrations';

type TimeRange = 'all' | '7d' | '24h';
type SortField = 'registeredAt' | 'fullName' | 'status';
type SortDirection = 'asc' | 'desc';

const dailyChartConfig = {
  count: {
    label: 'New Registrations',
    color: 'hsl(var(--chart-1))',
  },
};

const roleChartConfig = {
  count: {
    label: 'Attendees',
    color: 'hsl(var(--chart-2))',
  },
};

function StatusDisplay({ status }: { status: RegistrationStatus }) {
  if (status === 'Checked In') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        Checked In
      </span>
    );
  }
  if (status === 'Confirmed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary whitespace-nowrap">
        <UserCheck className="h-3.5 w-3.5 shrink-0" />
        Confirmed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
      <Clock className="h-3.5 w-3.5 shrink-0" />
      Pending Verification
    </span>
  );
}

export function RegistrationReport() {
  const { toast } = useToast();
  const { firestore, auth, user, isMfaVerified } = useFirebase();
  const [registrations, setRegistrations] = useState<UserRegistration[]>([]);
  const [firestoreRegistrations, setFirestoreRegistrations] = useState<
    FirestoreRegistrationRecord[]
  >([]);
  const [livePasses, setLivePasses] = useState<AttendeePassRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [trackFilter, setTrackFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('registeredAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [newRole, setNewRole] = useState('Ministry Lead');
  const [newTrack, setNewTrack] = useState<RegistrationTrack>('Morning & Afternoon');
  const [newSource, setNewSource] = useState<RegistrationSource>('Web Registration');

  const loadRegistrations = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      let localStored: UserRegistration[] = [];
      try {
        const raw = localStorage.getItem(REGISTRATIONS_STORAGE_KEY);
        if (raw) {
          localStored = JSON.parse(raw) as UserRegistration[];
        }
      } catch {
        localStored = [];
      }

      const res = await fetch('/api/registrations', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Failed to load registration report.');
      }
      const data = await res.json();
      const apiRows: UserRegistration[] = Array.isArray(data.registrations)
        ? data.registrations
        : initialRegistrations;

      const merged = mergeRegistrations(localStored, apiRows);
      setRegistrations(merged);
      try {
        localStorage.setItem(REGISTRATIONS_STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // Ignore storage quota errors
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to fetch registration data.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRegistrations();
  }, []);

  const isAdmin = isBootstrappedAdminUser(user);
  useEffect(() => {
    if (!firestore || !isAdmin || !isMfaVerified) {
      setLivePasses([]);
      setFirestoreRegistrations([]);
      return;
    }

    const unsubPasses = subscribeToAllAttendeePasses(
      firestore,
      auth,
      (items) => setLivePasses(items),
      () => {}
    );
    const unsubRegs = subscribeToFirestoreRegistrations(
      firestore,
      auth,
      (items) => setFirestoreRegistrations(items),
      () => {}
    );
    return () => {
      unsubPasses();
      unsubRegs();
    };
  }, [firestore, auth, isAdmin, isMfaVerified]);

  const syncedRegistrations = useMemo(() => {
    const baseMerged =
      firestoreRegistrations.length > 0
        ? mergeRegistrations(firestoreRegistrations, registrations)
        : registrations;

    if (livePasses.length === 0) return baseMerged;
    const byEmail = new Map<string, AttendeePassRecord>();
    for (const pass of livePasses) {
      if (pass.email) {
        byEmail.set(pass.email.toLowerCase(), pass);
      }
    }

    const seenEmails = new Set<string>();
    const updated = baseMerged.map((row) => {
      const key = row.email.toLowerCase();
      seenEmails.add(key);
      const match = byEmail.get(key);
      return match ? { ...row, status: match.status } : row;
    });

    for (const pass of livePasses) {
      const key = pass.email.toLowerCase();
      if (!seenEmails.has(key)) {
        updated.unshift({
          id: `pass-${pass.uid}`,
          fullName: pass.fullName,
          email: pass.email,
          organization: pass.organization,
          role: pass.role,
          track: pass.track,
          source: 'Web Registration',
          status: pass.status,
          registeredAt: new Date(pass.createdAtMs).toISOString(),
        });
      }
    }

    return updated;
  }, [registrations, firestoreRegistrations, livePasses]);

  const persistLocal = (updated: UserRegistration[]) => {
    try {
      localStorage.setItem(REGISTRATIONS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors
    }
  };

  const referenceNow = useMemo(() => {
    if (syncedRegistrations.length === 0) return new Date();
    const latestTs = Math.max(
      ...syncedRegistrations.map((r) => new Date(r.registeredAt).getTime())
    );
    return new Date(Math.max(latestTs, Date.now()));
  }, [syncedRegistrations]);

  const timeFilteredRegistrations = useMemo(() => {
    if (timeRange === 'all') return syncedRegistrations;
    const cutoff =
      timeRange === '24h'
        ? subHours(referenceNow, 24)
        : subDays(referenceNow, 7);
    return syncedRegistrations.filter((r) => isAfter(parseISO(r.registeredAt), cutoff));
  }, [syncedRegistrations, timeRange, referenceNow]);

  const filteredRegistrations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = timeFilteredRegistrations.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (trackFilter !== 'all' && item.track !== trackFilter) return false;
      if (!query) return true;
      return (
        item.fullName.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        item.organization.toLowerCase().includes(query) ||
        item.role.toLowerCase().includes(query)
      );
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'registeredAt') {
        comparison =
          new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime();
      } else if (sortField === 'fullName') {
        comparison = a.fullName.localeCompare(b.fullName);
      } else {
        comparison = a.status.localeCompare(b.status);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [
    timeFilteredRegistrations,
    searchQuery,
    statusFilter,
    trackFilter,
    sortField,
    sortDirection,
  ]);

  const metrics = useMemo(() => {
    const total = timeFilteredRegistrations.length;
    const cutoff24h = subHours(referenceNow, 24);
    const last24hCount = syncedRegistrations.filter((r) =>
      isAfter(parseISO(r.registeredAt), cutoff24h)
    ).length;
    const confirmedCount = timeFilteredRegistrations.filter(
      (r) => r.status === 'Confirmed' || r.status === 'Checked In'
    ).length;
    const checkedInCount = timeFilteredRegistrations.filter(
      (r) => r.status === 'Checked In'
    ).length;
    const pendingCount = timeFilteredRegistrations.filter(
      (r) => r.status === 'Pending Verification'
    ).length;
    const confirmedRate = total > 0 ? Math.round((confirmedCount / total) * 100) : 0;

    return {
      total,
      last24hCount,
      confirmedCount,
      checkedInCount,
      pendingCount,
      confirmedRate,
    };
  }, [timeFilteredRegistrations, syncedRegistrations, referenceNow]);

  const dailySeries = useMemo(() => {
    const countsByDay = new Map<string, { dayKey: string; label: string; count: number }>();
    for (const item of timeFilteredRegistrations) {
      const dateObj = parseISO(item.registeredAt);
      const dayKey = format(dateObj, 'yyyy-MM-dd');
      const label = format(dateObj, 'MMM d');
      const existing = countsByDay.get(dayKey);
      if (existing) {
        existing.count += 1;
      } else {
        countsByDay.set(dayKey, { dayKey, label, count: 1 });
      }
    }
    return Array.from(countsByDay.values()).sort((a, b) =>
      a.dayKey.localeCompare(b.dayKey)
    );
  }, [timeFilteredRegistrations]);

  const roleSeries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of timeFilteredRegistrations) {
      counts.set(item.role, (counts.get(item.role) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);
  }, [timeFilteredRegistrations]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'fullName' ? 'asc' : 'desc');
    }
  };

  const handleAddRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newName,
          email: newEmail,
          organization: newOrg || 'Summit Attendee',
          role: newRole,
          track: newTrack,
          source: newSource,
          status: 'Confirmed',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not save registration.');
      }

      const created: UserRegistration = data.registration;
      const updated = mergeRegistrations([created], registrations);
      setRegistrations(updated);
      persistLocal(updated);

      setNewName('');
      setNewEmail('');
      setNewOrg('');
      setDialogOpen(false);
      toast({
        title: data.duplicate ? 'Attendee already registered' : 'Registration recorded',
        description: `${created.fullName} is included in the registration report.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Registration failed',
        description:
          err instanceof Error ? err.message : 'Unable to add attendee.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: UserRegistration) => {
    const nextStatus: RegistrationStatus =
      item.status === 'Checked In'
        ? 'Confirmed'
        : item.status === 'Confirmed'
        ? 'Checked In'
        : 'Confirmed';

    const matchedPass = livePasses.find(
      (p) => p.email.toLowerCase() === item.email.toLowerCase()
    );

    if (matchedPass && firestore && user && isAdmin && isMfaVerified) {
      try {
        if (nextStatus === 'Checked In') {
          await checkInPassByOrganizer(firestore, auth, {
            payload: {
              v: 1,
              type: 'summit_pass',
              uid: matchedPass.uid,
              passCode: matchedPass.passCode,
              email: matchedPass.email,
              fullName: matchedPass.fullName,
              organization: matchedPass.organization,
              role: matchedPass.role,
              track: matchedPass.track,
              mfaVerifiedAt: matchedPass.mfaVerifiedAt,
              issuedAt: matchedPass.createdAtMs,
              exp: Date.now() + 86400000,
            },
            signatureDigest: matchedPass.qrSignatureDigest,
            organizerUid: user.uid,
          });
        } else if (nextStatus === 'Confirmed') {
          await revertPassCheckInByOrganizer(firestore, auth, matchedPass.uid);
        }
      } catch {
        // Fallback to local/API sync
      }
    }

    const updated = registrations.map((r) =>
      r.id === item.id ? { ...r, status: nextStatus } : r
    );
    setRegistrations(updated);
    persistLocal(updated);

    try {
      await fetch('/api/registrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          email: item.email,
          fullName: item.fullName,
          organization: item.organization,
          role: item.role,
          track: item.track,
          status: nextStatus,
        }),
      });
      toast({
        title: 'Status updated',
        description: `${item.fullName} marked as ${nextStatus}.`,
      });
    } catch {
      // Local state & storage remain updated
    }
  };

  const handleExportCsv = () => {
    const csv = registrationsToCsv(filteredRegistrations);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `summit-registrations-${format(new Date(), 'yyyy-MM-dd')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: 'CSV exported',
      description: `Downloaded ${filteredRegistrations.length} registration records.`,
    });
  };

  const clearFilters = () => {
    setTimeRange('all');
    setSearchQuery('');
    setStatusFilter('all');
    setTrackFilter('all');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between bg-card border border-border rounded-xl p-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            New User Registration Report
          </h2>
          <p className="text-sm text-muted-foreground">
            Leadership Summit · Attendee sign-up velocity, track selection, and check-in status
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-1">
            <button
              type="button"
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                timeRange === 'all'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                timeRange === '7d'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('24h')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                timeRange === '24h'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Last 24 Hours
            </button>
          </div>

          <Button
            variant="outline"
            asChild
            className="whitespace-nowrap shrink-0"
          >
            <Link href="/admin?tab=approvals">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Bulk Approvals
            </Link>
          </Button>

          <Button
            variant="outline"
            asChild
            className="whitespace-nowrap shrink-0"
          >
            <Link href="/pass?mode=scanner">
              <QrCode className="mr-2 h-4 w-4" />
              QR Check-In
            </Link>
          </Button>

          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={isLoading || filteredRegistrations.length === 0}
            className="whitespace-nowrap shrink-0"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="whitespace-nowrap shrink-0">
                <Plus className="mr-2 h-4 w-4" />
                Add Registration
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register Summit Attendee</DialogTitle>
                <DialogDescription>
                  Add a new attendee registration directly to the report.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddRegistration} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-fullname">Full Name</Label>
                  <Input
                    id="reg-fullname"
                    placeholder="Jane Mensah"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="jane@churchministry.org"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-org">Organization</Label>
                    <Input
                      id="reg-org"
                      placeholder="Grace Chapel"
                      value={newOrg}
                      onChange={(e) => setNewOrg(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-role">Role</Label>
                    <Select value={newRole} onValueChange={setNewRole}>
                      <SelectTrigger id="reg-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Senior Pastor">Senior Pastor</SelectItem>
                        <SelectItem value="Ministry Lead">Ministry Lead</SelectItem>
                        <SelectItem value="Operations & Strategy">
                          Operations &amp; Strategy
                        </SelectItem>
                        <SelectItem value="Youth & Outreach">
                          Youth &amp; Outreach
                        </SelectItem>
                        <SelectItem value="Volunteer Coordinator">
                          Volunteer Coordinator
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-track">Session Track</Label>
                    <Select
                      value={newTrack}
                      onValueChange={(v) => setNewTrack(v as RegistrationTrack)}
                    >
                      <SelectTrigger id="reg-track">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Morning & Afternoon">
                          Morning &amp; Afternoon
                        </SelectItem>
                        <SelectItem value="Morning Track">Morning Track</SelectItem>
                        <SelectItem value="Afternoon Track">Afternoon Track</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-source">Source</Label>
                    <Select
                      value={newSource}
                      onValueChange={(v) => setNewSource(v as RegistrationSource)}
                    >
                      <SelectTrigger id="reg-source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Web Registration">
                          Web Registration
                        </SelectItem>
                        <SelectItem value="Direct Invite">Direct Invite</SelectItem>
                        <SelectItem value="Ministry Partner">
                          Ministry Partner
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Registration'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load registrations</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{loadError}</span>
            <Button variant="outline" size="sm" onClick={loadRegistrations}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-medium text-muted-foreground">
            Total Registered Users
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {isLoading ? '—' : metrics.total}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {timeRange === 'all'
              ? 'All summit cohorts'
              : timeRange === '7d'
              ? 'Past 7 days'
              : 'Past 24 hours'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-medium text-muted-foreground">
            New in Last 24 Hours
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {isLoading ? '—' : metrics.last24hCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Recent attendee sign-ups
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-medium text-muted-foreground">
            Confirmed Rate
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {isLoading ? '—' : `${metrics.confirmedRate}%`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {metrics.confirmedCount} of {metrics.total} verified
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-medium text-muted-foreground">
            Checked-In / Pending
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {isLoading ? '—' : `${metrics.checkedInCount} / ${metrics.pendingCount}`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            On-site arrival vs awaiting check
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              Daily New Registrations
            </h3>
            <p className="text-xs text-muted-foreground">
              Sign-up volume by registration date
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : dailySeries.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
              No registrations recorded in the selected window.
            </div>
          ) : (
            <div className="h-64">
              <ChartContainer config={dailyChartConfig} className="w-full h-full">
                <BarChart
                  data={dailySeries}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent />}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              Registrations by Role
            </h3>
            <p className="text-xs text-muted-foreground">
              Distribution across ministry responsibilities
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : roleSeries.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
              No role breakdown available.
            </div>
          ) : (
            <div className="h-64">
              <ChartContainer config={roleChartConfig} className="w-full h-full">
                <BarChart
                  data={roleSeries}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" allowDecimals={false} hide />
                  <YAxis
                    dataKey="role"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={130}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent />}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          )}
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Registered Attendees
            </h3>
            <p className="text-xs text-muted-foreground tabular-nums">
              Showing {filteredRegistrations.length} of{' '}
              {timeFilteredRegistrations.length} registrations
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search name, email, or church..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-64"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Checked In">Checked In</SelectItem>
                <SelectItem value="Confirmed">Confirmed</SelectItem>
                <SelectItem value="Pending Verification">
                  Pending Verification
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={trackFilter} onValueChange={setTrackFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All Tracks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tracks</SelectItem>
                <SelectItem value="Morning & Afternoon">
                  Morning &amp; Afternoon
                </SelectItem>
                <SelectItem value="Morning Track">Morning Track</SelectItem>
                <SelectItem value="Afternoon Track">Afternoon Track</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="h-11 w-full" />
            ))}
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="py-12 px-4 text-center border border-dashed border-border rounded-lg">
            <p className="text-sm font-medium text-foreground">
              No matching registrations found
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Adjust your search query or filters to view attendee sign-ups.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('fullName')}
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                  >
                    Attendee
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </TableHead>
                <TableHead>Organization &amp; Role</TableHead>
                <TableHead>Track &amp; Source</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('registeredAt')}
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                  >
                    Registered
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort('status')}
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                  >
                    Status
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRegistrations.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="py-3">
                    <div className="font-medium text-foreground">
                      {item.fullName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.email}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="text-sm text-foreground">
                      {item.organization}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.role}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="text-sm text-foreground">{item.track}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.source}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap">
                    {format(parseISO(item.registeredAt), 'MMM d, yyyy · HH:mm')}
                  </TableCell>
                  <TableCell className="py-3">
                    <StatusDisplay status={item.status} />
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(item)}
                      className="whitespace-nowrap shrink-0"
                    >
                      {item.status === 'Checked In'
                        ? 'Undo Check-In'
                        : item.status === 'Confirmed'
                        ? 'Check In'
                        : 'Confirm'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
