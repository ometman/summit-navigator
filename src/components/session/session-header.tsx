import { type Session } from "@/lib/data";
import Link from 'next/link';

export default function SessionHeader({ session }: { session: Session }) {
  const speakerUrl = `/speaker/${session.speaker.replace(/\s/g, "+")}`;
  return (
    <>
      <p className="text-sm font-semibold text-muted-foreground mb-2">
        {session.time} | Session {session.id}
      </p>
      <h2 className="text-3xl font-extrabold text-foreground mb-2">{session.title}</h2>
      <Link href={speakerUrl} className="text-xl font-semibold text-primary mb-4 hover:underline">
        {session.speaker}
      </Link>
    </>
  );
}
