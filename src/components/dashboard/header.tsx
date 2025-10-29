import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import Link from "next/link";

export function Header() {
  return (
    <header className="relative text-center py-6 bg-white rounded-xl shadow-md mb-8">
      <div className="absolute top-4 right-4">
        <Button asChild variant="outline">
          <Link href="/login">
            <User className="mr-2" /> Login
          </Link>
        </Button>
      </div>
      <h1 className="text-4xl font-extrabold text-foreground">Summit Navigator</h1>
      <p className="mt-2 text-xl text-muted-foreground">Theme: Preparing the Workforce for Growth and Impact</p>
      <p className="text-sm text-muted-foreground/80 mt-1">Start: 9:00 AM | Close: 3:45 PM</p>
    </header>
  );
}