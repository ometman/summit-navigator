'use client';

import { Button } from '@/components/ui/button';
import { User, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export function Header() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  const isAnonymous = !user || user.isAnonymous;

  return (
    <header className="relative text-center py-6 bg-white rounded-xl shadow-md mb-8">
      <div className="absolute top-4 right-4">
        {isUserLoading ? null : isAnonymous ? (
          <Button asChild variant="outline">
            <Link href="/login">
              <User className="mr-2" /> Login
            </Link>
          </Button>
        ) : (
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2" /> Logout
          </Button>
        )}
      </div>
      <h1 className="text-4xl font-extrabold text-foreground">
        Summit Navigator
      </h1>
      <p className="mt-2 text-xl text-muted-foreground">
        Theme: Preparing the Workforce for Growth and Impact
      </p>
      <p className="text-sm text-muted-foreground/80 mt-1">
        Start: 9:00 AM | Close: 3:45 PM
      </p>
    </header>
  );
}
