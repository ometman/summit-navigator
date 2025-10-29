import { type Session } from "@/lib/data";

export default function Session5Content({ session }: { session: Session }) {
    return (
        <div className="space-y-6 text-gray-700">
            <blockquote className="p-4 border-l-4 border-blue-500 bg-blue-50 italic rounded">
                <p className="font-bold text-lg text-blue-800">Theme Scripture:</p>
                <p>“Let all things be done decently and in order.” — <span className="font-semibold">1 Corinthians 14:40</span></p>
            </blockquote>

            <div className="p-4 bg-gray-50 rounded-lg shadow-sm">
                <p className="text-sm font-semibold text-gray-600 mb-2">Trainer:</p>
                <p className="font-bold text-lg text-foreground">{session.speaker}</p>
                <p className="text-sm font-semibold text-gray-600 mt-2">Target Audience:</p>
                <p className="text-sm">Pastors, Worship Leaders, Departmental Heads, Service Coordinators, and Church Administrators</p>
            </div>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">Training Objectives</h4>
            <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Understand the purpose and structure of a Spirit-filled, contemporary church service.</li>
                <li>Identify the key components and teams involved in delivering effective services.</li>
                <li>Learn practical methods to create engaging, orderly, and impactful worship experiences.</li>
                <li>Build a model for continuous improvement and member engagement during Sunday services.</li>
            </ul>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">⏰ Session Breakdown (40 Minutes Total)</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-sm font-medium">
                <div className="p-2 bg-blue-100 rounded">1. Intro (5 min)</div>
                <div className="p-2 bg-blue-100 rounded">2. Purpose (10 min)</div>
                <div className="p-2 bg-blue-100 rounded">3. Structure & Teams (10 min)</div>
                <div className="p-2 bg-blue-100 rounded">4. Engagement (10 min)</div>
                <div className="p-2 bg-blue-100 rounded">5. Discussion (5 min)</div>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-blue-500 pl-3">🕊️ 1. Introduction & Devotional Thought (5 mins)</h5>
                <p className="mb-2"><strong>Activity:</strong> Ask participants: “What do you think makes people look forward to coming to your Sunday service—or not?”</p>
                <p className="mb-2">This introduces the theme — many churches have sincere passion but lack intentional planning for impactful service delivery.</p>
                <p className="italic text-sm text-gray-600">Mini-Devotional Thought: Psalm 100:2 — “Serve the Lord with gladness; come before His presence with singing.” The church service is not a performance but an offering to God. Excellence in service delivery reflects honor, order, and reverence toward the Lord.</p>
                <p className="mt-2"><strong>Key Insight:</strong> A Spirit-filled church must also be strategically organized. Passion without preparation leads to chaos; preparation without passion leads to boredom.</p>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-blue-500 pl-3">📖 2. The Purpose of a Dynamic Church Service (10 mins)</h5>
                <p className="font-semibold text-gray-800">A. Definition</p>
                <p className="ml-4">A church service is the intentional gathering of believers to worship, learn, fellowship, and encounter God together — in a way that inspires transformation and commitment.</p>
                <p className="font-semibold text-gray-800 mt-2">B. Biblical Basis</p>
                <p className="ml-4">The Early Church gathered for fellowship, teaching, and breaking of bread (Acts 2:42–47). Jesus often organized His ministry settings — sitting the people in groups, giving instructions to disciples (Mark 6:39–41). Paul emphasized order in worship (1 Corinthians 14:33, 40).</p>
                <p className="font-semibold text-gray-800 mt-2">C. Purpose of the Church Service</p>
                <ul className="list-disc list-inside ml-8">
                    <li>Worship: To glorify God collectively.</li>
                    <li>Word: To build faith and knowledge of Christ.</li>
                    <li>Witness: To inspire and attract the unsaved.</li>
                    <li>Fellowship: To build relationships and spiritual community.</li>
                    <li>Mobilization: To send believers into mission and service.</li>
                </ul>
                <p className="font-semibold text-gray-800 mt-2">D. Why Excellence in Service Matters</p>
                <p className="ml-4">Creates a positive spiritual and emotional atmosphere, builds consistency and anticipation among members, demonstrates leadership discipline and organizational maturity, and honors God, reflecting His excellence.</p>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-blue-500 pl-3">🧭 3. Structure and Key Teams for Effective Service Delivery (10 mins)</h5>
                <p className="font-semibold text-gray-800">A. Pre-Service Preparation</p>
                <p className="ml-4">Prayer & Spiritual Readiness, Technical Checks, Environment Setup, and Team Briefing.</p>
                <p className="font-semibold text-gray-800 mt-2">B. Suggested Service Flow</p>
                <ul className="list-disc list-inside ml-8">
                    <li>Opening & Welcome (5 mins)</li>
                    <li>Praise & Worship (20–25 mins)</li>
                    <li>Announcements & Giving (10 mins)</li>
                    <li>Word Ministration (30–40 mins)</li>
                    <li>Altar Call & Response (5–10 mins)</li>
                    <li>Closing & Fellowship (5 mins)</li>
                </ul>
                <p className="font-semibold text-gray-800 mt-2">C. Key Teams in Service Delivery</p>
                <p className="ml-4">Pastoral & Preaching, Worship & Music, Ushering & Protocol, Media & Tech, Intercessory, Hospitality & Follow-up, and Children & Youth Teams.</p>
                <p className="font-semibold text-gray-800 mt-2">D. Coordination System</p>
                <p className="ml-4">Create a Service Coordination Committee, conduct weekly service reviews, and use digital tools for scheduling.</p>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-blue-500 pl-3">⚙️ 4. Making Church Services Engaging, Impactful, and Spirit-Filled (10 mins)</h5>
                <p className="font-semibold text-gray-800">A. Keys to Dynamic Service Experience</p>
                <p className="ml-4">Spirit-Led but Structured, Contemporary Relevance, Creative Communication, Engaging Participation, Time Excellence, and Follow-up Integration.</p>
                <p className="font-semibold text-gray-800 mt-2">B. Evaluating Service Effectiveness</p>
                <p className="ml-4">Use post-service metrics: Attendance trends, first-timer retention, online engagement, and member feedback.</p>
                <p className="font-semibold text-gray-800 mt-2">C. Maintaining Spiritual Sensitivity</p>
                <p className="ml-4">Begin with prayer, discern moments for altar calls, and balance energy with depth. Key thought: “We prepare like professionals, but minister like priests.”</p>
            </div>

            <div className="pt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <h5 className="text-lg font-extrabold text-red-800 mb-2 border-l-4 border-red-500 pl-3">💬 5. Discussion, Reflection & Commitment (5 mins)</h5>
                <p className="font-semibold text-gray-800 mb-1">Discussion Questions:</p>
                <ul className="list-disc list-inside ml-4">
                    <li>Which aspect of your church service needs the most improvement?</li>
                    <li>How can each department contribute to an unforgettable Sunday experience?</li>
                    <li>What systems can ensure consistency and excellence?</li>
                </ul>
                <p className="italic text-sm text-red-600 mt-3">Commitment Prayer: “Lord, make our church services living encounters with You. Teach us to balance structure with Spirit, creativity with reverence, and excellence with humility. May every service lead souls to Christ and bring glory to Your Name. Amen.”</p>
            </div>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">🏁 Summary Key Takeaways</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
                <li>The Sunday service is the heartbeat of the church’s mission.</li>
                <li>Spirit and structure must coexist.</li>
                <li>Excellence in delivery reflects the excellence of God.</li>
                <li>Every department contributes to atmosphere, order, and impact.</li>
                <li>Continuous evaluation ensures improvement.</li>
            </ul>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">📚 Recommended Scriptures for Further Study</h4>
            <p>1 Corinthians 14:40, Psalm 100:1–5, Acts 2:42–47, Colossians 3:23, Nehemiah 8:1–8</p>
        </div>
    );
}
