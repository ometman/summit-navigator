import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { agendaData, speakerData, type Speaker } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Mic } from "lucide-react";
import BackButton from "@/components/session/back-button";

function getSpeakerDetails(name: string): Speaker | undefined {
    const decodedName = decodeURIComponent(name.replace(/\+/g, ' '));
    return speakerData.find(s => s.name === decodedName);
}

export default function SpeakerPage({ params }: { params: { name: string } }) {
  const speaker = getSpeakerDetails(params.name);

  if (!speaker) {
    notFound();
  }

  const speakerSessions = agendaData.filter(s => s.speaker === speaker.name);

  return (
    <>
        <div className="mb-6">
            <BackButton />
        </div>
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="relative h-48 w-full bg-primary/10">
                <Image
                src={speaker.imageUrl}
                alt={speaker.name}
                fill
                className="object-cover"
                data-ai-hint={speaker.imageHint}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6">
                    <h1 className="text-4xl font-extrabold text-white">{speaker.name}</h1>
                    <p className="text-lg text-accent">{speaker.role}</p>
                </div>
            </div>

            <div className="p-8">
                <Card className="mb-8 border-dashed bg-muted/30">
                    <CardHeader>
                        <CardTitle className="text-xl">About {speaker.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-foreground/80">{speaker.bio}</p>
                    </CardContent>
                </Card>

                <h2 className="text-2xl font-bold text-foreground mb-4 border-b pb-2">Sessions by {speaker.name}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {speakerSessions.map(session => (
                        <Link key={session.id} href={`/session/${session.id}`} className="block group">
                             <Card className="h-full transition-all duration-300 group-hover:shadow-xl group-hover:border-primary">
                                <CardHeader>
                                    <CardTitle className="text-primary text-lg group-hover:underline">{session.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Clock className="w-4 h-4" />
                                        <span>{session.time}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Mic className="w-4 h-4" />
                                        <span>Total Duration: {session.content + session.qa + session.prayer} min</span>
                                    </div>
                                    <p className="text-sm text-foreground/70 pt-2">{session.summary.substring(0, 100)}...</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    </>
  );
}

export function generateStaticParams() {
  return speakerData.map((speaker) => ({
    name: speaker.name.replace(/\s/g, '+'),
  }));
}
