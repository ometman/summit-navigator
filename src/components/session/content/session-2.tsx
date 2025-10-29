import { type Session } from "@/lib/data";

export default function Session2Content({ session }: { session: Session }) {
    return (
        <div className="space-y-6 text-gray-700">
            <blockquote className="p-4 border-l-4 border-green-500 bg-green-50 italic rounded">
                <p className="font-bold text-lg text-green-800">Theme Scripture:</p>
                <p>“Write the vision and make it plain on tablets, that he may run who reads it.” — <span className="font-semibold">Habakkuk 2:2</span></p>
            </blockquote>

            <div className="p-4 bg-gray-50 rounded-lg shadow-sm">
                <p className="text-sm font-semibold text-gray-600 mb-2">Trainer:</p>
                <p className="font-bold text-lg text-foreground">{session.speaker} (Church Training Consultant)</p>
                <p className="text-sm font-semibold text-gray-600 mt-2">Target Audience:</p>
                <p className="text-sm">Pastors, Elders, Departmental Heads, and Church Administrators</p>
            </div>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">Training Objectives</h4>
            <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Understand the role of strategic planning in advancing the church’s mission.</li>
                <li>Identify key departments essential for effective church operations.</li>
                <li>Learn how to develop and implement policies that ensure consistency, accountability, and growth.</li>
                <li>Build a model that integrates vision, strategy, structure, and spirit for a thriving ministry.</li>
            </ul>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">⏰ Session Breakdown (40 Minutes Total)</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-sm font-medium">
                <div className="p-2 bg-green-100 rounded">1. Intro (5 min)</div>
                <div className="p-2 bg-green-100 rounded">2. Purpose (10 min)</div>
                <div className="p-2 bg-green-100 rounded">3. Departments (10 min)</div>
                <div className="p-2 bg-green-100 rounded">4. Policies (10 min)</div>
                <div className="p-2 bg-green-100 rounded">5. Discussion (5 min)</div>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-green-500 pl-3">🕊️ 1. Introduction & Icebreaker (5 mins)</h5>
                <p className="mb-2"><strong>Activity:</strong> Ask participants: “If your church were a company, what would your ‘strategic plan’ or ‘policy manual’ look like today?” (Sets the tone for operating from policy, not just passion.)</p>
                <p className="italic text-sm text-gray-600">Mini-Devotional Thought: Proverbs 24:3–4 — “By wisdom a house is built...”</p>
                <p className="mt-2"><strong>Core Principle:</strong> The Church is spiritual, but it must also be <strong>strategic</strong>. Vision without structure leads to frustration; structure without spirit leads to stagnation.</p>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-green-500 pl-3">📖 2. The Purpose of Church Strategy (10 mins)</h5>
                <p className="font-semibold text-gray-800">A. What is Strategy?</p>
                <p className="ml-4">A clear plan that translates vision into <strong>actionable steps</strong> toward fulfilling the church’s mission.</p>
                <p className="font-semibold text-gray-800 mt-2">B. Biblical Basis</p>
                <p className="ml-4">Jesus had a clear strategy (choosing 12, focusing on making disciples). Nehemiah had a strategic plan for rebuilding the walls (Nehemiah 2–6).</p>
                <p className="font-semibold text-gray-800 mt-2">C. Components of an Effective Church Strategy</p>
                <ul className="list-disc list-inside ml-8">
                    <li><strong>Vision/Mission Clarity:</strong> Where are we going and why?</li>
                    <li><strong>Core Values:</strong> What defines our culture?</li>
                    <li><strong>Goals & Objectives:</strong> What do we want to achieve this year?</li>
                    <li><strong>Evaluation Metrics:</strong> How do we measure success?</li>
                </ul>
                <p className="font-semibold text-gray-800 mt-2">D. Strategic Focus Areas</p>
                <p className="ml-4">Spiritual Growth, Membership & Engagement, Financial Health, Community Impact, and Leadership Development.</p>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-green-500 pl-3">🧭 3. Key Church Departments and Functional Systems (10 mins)</h5>
                 <p className="font-semibold text-gray-800">A. The Ministry (Spiritual) Departments</p>
                 <p className="ml-4">Pastoral, Evangelism, Worship, Intercession, Discipleship.</p>
                 <p className="font-semibold text-gray-800 mt-2">B. The Administrative Departments</p>
                 <p className="ml-4">Administration & Operations, Finance & Audit, Human Resource & Volunteers, Facilities, Media & Technology.</p>
                 <p className="font-semibold text-gray-800 mt-2">C. The Growth & Engagement Departments</p>
                 <p className="ml-4">Hospitality, Youth/NextGen, Women/Men’s Ministries, Education, Community Development.</p>
                 <p className="font-semibold text-gray-800 mt-2">D. Coordination System</p>
                 <p className="ml-4">Establish a <strong>Departmental Heads Council</strong> for alignment. Use monthly operational reviews and integrate digital tools (CRM, Trello) for coordination.</p>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-green-500 pl-3">⚙️ 4. Building Winning Policies for Church Operations (10 mins)</h5>
                <p className="font-semibold text-gray-800">A. What is a Church Policy?</p>
                <p className="ml-4">A written principle or rule that guides operations in line with Scripture and values. They promote <strong>order</strong> (1 Corinthians 14:40) and <strong>accountability</strong>.</p>
                <p className="font-semibold text-gray-800 mt-2">B. Essential Policy Areas</p>
                <ul className="list-disc list-inside ml-8">
                    <li><strong>Financial Policy:</strong> Define offering handling, budget approvals, and require audits.</li>
                    <li><strong>Leadership & Governance Policy:</strong> Define hierarchy, roles, and accountability lines.</li>
                    <li><strong>Human Resource Policy:</strong> Cover recruitment, code of conduct, and volunteer welfare.</li>
                    <li><strong>Conflict Resolution Policy:</strong> Use a Biblical approach focused on mediation and restoration (Matthew 18:15–17).</li>
                    <li><strong>Data and Record Policy:</strong> Ensure secure management and compliance with data protection laws.</li>
                </ul>
                <p className="font-semibold text-gray-800 mt-2">C. Implementing Policies Successfully</p>
                <p className="ml-4"><strong>Document and Distribute</strong>. <strong>Train and Explain</strong>. <strong>Review and Revise</strong> annually. <strong>Model from the Top</strong>.</p>
            </div>

            <div className="pt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <h5 className="text-lg font-extrabold text-red-800 mb-2 border-l-4 border-red-500 pl-3">💬 5. Discussion, Reflection & Commitment (5 mins)</h5>
                <p className="font-semibold text-gray-800 mb-1">Discussion Questions:</p>
                <ul className="list-disc list-inside ml-4">
                    <li>Which policy area in your church needs the most attention right now?</li>
                    <li>Do your departments have clear goals and reporting systems?</li>
                    <li>How can you balance spiritual passion with operational excellence?</li>
                </ul>
                <p className="italic text-sm text-red-600 mt-3">Commitment Prayer: “Lord, grant us wisdom to lead Your church with vision, order, and excellence. Help us to build systems that serve Your Spirit and policies that honor Your principles.”</p>
            </div>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">🏁 Summary Key Takeaways</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Strategy gives direction, structure gives stability, and policy gives discipline.</li>
                <li>Every healthy church integrates vision, structure, and Spirit.</li>
                <li>Departments multiply effectiveness when coordinated under one mission.</li>
                <li>Policies protect the church’s integrity, resources, and reputation.</li>
                <li>The goal is not bureaucracy but Biblical order that sustains revival.</li>
            </ul>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">📚 Recommended Scriptures for Further Study</h4>
            <p>Habakkuk 2:2–3, Proverbs 24:3–4, 1 Corinthians 14:40, Nehemiah 2:17–20, Luke 14:28–30, Exodus 18:17–23</p>
        </div>
    );
}
