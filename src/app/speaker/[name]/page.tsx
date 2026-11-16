import { notFound } from "next/navigation";
import { speakerData, type Speaker } from "@/lib/data";
import BackButton from "@/components/session/back-button";
import { SpeakerDetailClient } from "@/components/speaker/speaker-detail-client";

function getSpeakerDetails(name: string): Speaker | undefined {
  const decodedName = decodeURIComponent(name).replace(/\+/g, ' ');
  return speakerData.find((s) => s.name === decodedName);
}

export default async function SpeakerPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const speaker = getSpeakerDetails(name);

  if (!speaker) {
    notFound();
  }

  return (
    <>
      <div className="mb-6">
        <BackButton />
      </div>
      <SpeakerDetailClient baseSpeaker={speaker} />
    </>
  );
}

export function generateStaticParams() {
  return speakerData.map((speaker) => ({
    name: speaker.name.replace(/\s/g, '+'),
  }));
}
