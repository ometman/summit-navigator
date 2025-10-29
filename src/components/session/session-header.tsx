import { type Session } from "@/lib/data";

export default function SessionHeader({ session }: { session: Session }) {
  return (
    <>
      <p className="text-sm font-semibold text-muted-foreground mb-2">
        {session.time} | Session {session.id}
      </p>
      <h2 className="text-3xl font-extrabold text-foreground mb-2">{session.title}</h2>
      <p className="text-xl font-semibold text-primary mb-4">{session.speaker}</p>
    </>
  );
}
