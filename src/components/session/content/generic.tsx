import { type Session } from "@/lib/data";

export default function GenericContent({ session }: { session: Session }) {
  return (
    <div className="space-y-6">
      <blockquote className="p-4 border-l-4 border-gray-400 bg-gray-50 text-gray-700 italic rounded">
        <p className="font-bold text-lg text-gray-800">Session Focus:</p>
        <p>{session.summary}</p>
      </blockquote>

      <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">
        Key Discussion Points
      </h4>
      <ul className="list-disc list-inside space-y-2 ml-4 text-gray-700">
        <li>
          Core foundational principles related to{" "}
          <strong>{session.title.toLowerCase()}</strong>.
        </li>
        <li>
          Practical strategies for implementation in your local ministry setting.
        </li>
        <li>Open Q&A to address common challenges and best practices.</li>
      </ul>

      <div className="pt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <h5 className="text-lg font-extrabold text-yellow-800 mb-2 border-l-4 border-yellow-500 pl-3">
          Preparation Note
        </h5>
        <p className="text-gray-700">
          Please come prepared with 1-2 questions related to the organizational
          or spiritual aspects of this session's topic to maximize your
          learning experience and contribution to the discussion.
        </p>
      </div>
    </div>
  );
}
