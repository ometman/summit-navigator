import { type Session } from "@/lib/data";

export default function SessionStats({ session }: { session: Session }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mt-6 mb-8">
      <div className="p-4 bg-green-50 rounded-lg border-b-4 border-green-500 shadow-inner">
        <p className="text-sm text-green-700 font-medium">Content Time</p>
        <p className="text-3xl font-bold text-green-900">{session.content} min</p>
      </div>
      <div className="p-4 bg-blue-50 rounded-lg border-b-4 border-blue-500 shadow-inner">
        <p className="text-sm text-blue-700 font-medium">Q&A & Discussion</p>
        <p className="text-3xl font-bold text-blue-900">{session.qa} min</p>
      </div>
      <div className="p-4 bg-red-50 rounded-lg border-b-4 border-red-500 shadow-inner">
        <p className="text-sm text-red-700 font-medium">Prayer/Transition</p>
        <p className="text-3xl font-bold text-red-900">{session.prayer} min</p>
      </div>
    </div>
  );
}
