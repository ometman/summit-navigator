'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { User, LogOut, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { getUserAdminRole, type UserAdminRole } from '@/firebase/admin-content';
import { signOutFirebase } from '@/firebase/non-blocking-login';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Header() {
  const { user, isUserLoading, isMfaVerified, isMfaLoading, setMfaVerified } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const [adminRole, setAdminRole] = useState<UserAdminRole>('attendee');

  useEffect(() => {
    let cancelled = false;
    const resolveRole = async () => {
      if (!firestore || !user || user.isAnonymous || !isMfaVerified) {
        if (!cancelled) setAdminRole('attendee');
        return;
      }
      try {
        const role = await getUserAdminRole(firestore, auth, user);
        if (!cancelled) setAdminRole(role);
      } catch {
        if (!cancelled) setAdminRole('attendee');
      }
    };
    resolveRole();
    return () => {
      cancelled = true;
    };
  }, [firestore, auth, user, isMfaVerified]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/otp', { method: 'DELETE' });
      setMfaVerified(false);
      if (auth) {
        await signOutFirebase(auth);
      }
      router.push('/login');
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  const hasGoogleUser = Boolean(user && !user.isAnonymous);
  const isFullyAuthenticated = hasGoogleUser && isMfaVerified;
  const isAuthChecking = isUserLoading || (hasGoogleUser && isMfaLoading);
  const hasAdminConsoleAccess = adminRole !== 'attendee';

  return (
    <header className="relative bg-white rounded-xl shadow-md mb-8 px-6 py-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4 mb-4">
        <Link
          href="/"
          className="text-xl font-extrabold tracking-tight text-foreground whitespace-nowrap shrink-0"
        >
          Summit Navigator
        </Link>

        <nav className="flex flex-wrap items-center gap-5 text-sm font-medium">
          <Link
            href="/dashboard"
            className={cn(
              'whitespace-nowrap shrink-0 transition-colors hover:text-primary',
              pathname === '/dashboard'
                ? 'text-primary underline underline-offset-8'
                : 'text-muted-foreground'
            )}
          >
            Dashboard
          </Link>
          <Link
            href="/action-plan"
            className={cn(
              'whitespace-nowrap shrink-0 transition-colors hover:text-primary',
              pathname === '/action-plan'
                ? 'text-primary underline underline-offset-8'
                : 'text-muted-foreground'
            )}
          >
            Action Plan
          </Link>
          <Link
            href="/directory"
            className={cn(
              'whitespace-nowrap shrink-0 transition-colors hover:text-primary',
              pathname === '/directory'
                ? 'text-primary underline underline-offset-8'
                : 'text-muted-foreground'
            )}
          >
            Directory
          </Link>
          <Link
            href="/pass"
            className={cn(
              'whitespace-nowrap shrink-0 transition-colors hover:text-primary',
              pathname === '/pass'
                ? 'text-primary underline underline-offset-8'
                : 'text-muted-foreground'
            )}
          >
            Attendee Pass
          </Link>
          <Link
            href="/dashboard/registrations"
            className={cn(
              'whitespace-nowrap shrink-0 transition-colors hover:text-primary',
              pathname === '/dashboard/registrations'
                ? 'text-primary underline underline-offset-8'
                : 'text-muted-foreground'
            )}
          >
            Registrations
          </Link>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {isAuthChecking ? null : isFullyAuthenticated ? (
            <>
              <span className="hidden xl:inline text-xs text-muted-foreground max-w-[160px] truncate">
                {user?.displayName || user?.email}
              </span>
              {hasAdminConsoleAccess && (
                <Button
                  asChild
                  variant={pathname === '/admin' ? 'default' : 'outline'}
                  size="sm"
                  className="whitespace-nowrap shrink-0"
                >
                  <Link href="/admin">
                    <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                    Admin Console
                  </Link>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleLogout} className="whitespace-nowrap shrink-0">
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </Button>
            </>
          ) : hasGoogleUser ? (
            <>
              <Button asChild variant="default" size="sm" className="whitespace-nowrap shrink-0">
                <Link href="/login">
                  <ShieldCheck className="mr-2 h-4 w-4" /> Verify OTP
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} className="whitespace-nowrap shrink-0">
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="whitespace-nowrap shrink-0">
                <Link href="/register">Register</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="whitespace-nowrap shrink-0">
                <Link href="/login">
                  <User className="mr-2 h-4 w-4" /> Login
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">
          Summit Navigator
        </h1>
        <p className="mt-2 text-lg md:text-xl text-muted-foreground">
          Theme: Preparing the Workforce for Growth and Impact
        </p>
        <p className="text-sm text-muted-foreground/80 mt-1">
          Start: 9:00 AM | Close: 3:45 PM
        </p>
      </div>
    </header>
  );
}
