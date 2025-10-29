import { type Session } from "@/lib/data";

export default function Session6Content({ session }: { session: Session }) {
    return (
        <div className="space-y-6 text-gray-700">
            <blockquote className="p-4 border-l-4 border-indigo-500 bg-indigo-50 italic rounded">
                <p className="font-bold text-lg text-indigo-800">Theme Scripture:</p>
                <p>“And the Lord added to the church daily those who were being saved.” — <span className="font-semibold">Acts 2:47</span></p>
            </blockquote>

            <div className="p-4 bg-gray-50 rounded-lg shadow-sm">
                <p className="text-sm font-semibold text-gray-600 mb-2">Trainer:</p>
                <p className="font-bold text-lg text-foreground">{session.speaker} (Theologian & Church Training Consultant)</p>
                <p className="text-sm font-semibold text-gray-600 mt-2">Target Audience:</p>
                <p className="text-sm">Pastors, Elders, Departmental Heads, and Administrative Leaders</p>
            </div>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">Training Objectives</h4>
            <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Understand the biblical foundation of church membership and belonging.</li>
                <li>Appreciate the value of structured membership systems for growth and discipleship.</li>
                <li>Learn effective methods for tracking, nurturing, and retaining members.</li>
                <li>Identify practical tools and policies for managing church membership in the digital age.</li>
            </ul>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">⏰ Session Breakdown (40 Minutes Total)</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-sm font-medium">
                <div className="p-2 bg-indigo-100 rounded">1. Intro (5 min)</div>
                <div className="p-2 bg-indigo-100 rounded">2. Foundation (10 min)</div>
                <div className="p-2 bg-indigo-100 rounded">3. Dimensions (10 min)</div>
                <div className="p-2 bg-indigo-100 rounded">4. Systems (10 min)</div>
                <div className="p-2 bg-indigo-100 rounded">5. Discussion (5 min)</div>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-blue-500 pl-3">🕊️ 1. Introduction & Icebreaker (5 mins)</h5>
                <p className="mb-2"><strong>Activity:</strong> Ask: “If your church had to find 10 members today who have been missing for the past two months—how easily could you do it?” (Exposes the importance of organized systems.)</p>
                <p className="italic text-sm text-gray-600">Mini-Devotional Thought: Membership is not about numbers, but about people and discipleship. John 10:14: “I know my sheep...”</p>
                <p className="mt-2"><strong>Leader's Mandate:</strong> God expects leaders to know, track, and care for their flock <strong>personally and administratively</strong>.</p>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-blue-500 pl-3">📖 2. The Biblical Foundation of Church Membership (10 mins)</h5>
                <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Theology of Belonging:</strong> We are "members of God’s household" (Ephesians 2:19). Membership is spiritual before it is administrative.</li>
                    <li><strong>Early Church Example:</strong> Acts 2:41–47 shows an identifiable body where people were "added," enabling mutual care and growth.</li>
                    <li><strong>Pastoral Responsibility:</strong> Accountability (Hebrews 13:17) is impossible without proper member tracking.</li>
                    <li><strong>Theological Insight:</strong> “God does not shepherd crowds; He shepherds <strong>congregations</strong>.”</li>
                </ul>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-blue-500 pl-3">🌱 3. The Dimensions of Church Membership Management (10 mins)</h5>
                <ul className="list-disc list-inside space-y-3 ml-4">
                    <li><strong>Identification:</strong> Clear process for recognizing and recording members. Define categories (visitors, members, workers).</li>
                    <li><strong>Integration:</strong> Develop new members’ class to teach vision, doctrine, and responsibilities. Assign mentors for follow-up.</li>
                    <li><strong>Discipleship:</strong> Connect every member to spiritual growth programs (small groups, Bible studies). Build tracking systems for engagement.</li>
                    <li><strong>Care:</strong> Establish pastoral care (visits, counseling) and welfare/support systems. Recognize milestones.</li>
                    <li><strong>Accountability:</strong> Periodic evaluation of participation. Discipline with love when necessary. Encourage giving and serving.</li>
                </ul>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-blue-500 pl-3">⚙️ 4. Practical Systems & Tools for Managing Members (10 mins)</h5>
                <div className="space-y-2">
                    <p className="font-semibold text-gray-800">A. Administrative Systems:</p>
                    <p className="ml-4">Maintain a <strong>Membership Register/Database</strong>. Record personal details, ministry involvement, giving, and discipleship progress.</p>
                    <p className="font-semibold text-gray-800">B. Communication Systems:</p>
                    <p className="ml-4">Use channels like email lists or SMS alerts. <strong>Segment members</strong> by department or location for targeted communication.</p>
                    <p className="font-semibold text-gray-800">C. Follow-up and Retention:</p>
                    <p className="ml-4">Train follow-up teams to contact new visitors within <strong>48 hours</strong>. Establish periodic member engagement drives.</p>
                    <p className="font-semibold text-gray-800">D. Leadership Oversight:</p>
                    <p className="ml-4">Assign leaders to monitor clusters (shepherding model). Review membership data and prayer lists monthly.</p>
                    <p className="font-semibold text-gray-800">E. Digital Transformation:</p>
                    <p className="ml-4">Use mobile apps or web systems for digital check-in, managing online giving, and recording prayer requests while protecting data.</p>
                </div>
            </div>

            <div className="pt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <h5 className="text-lg font-extrabold text-red-800 mb-2 border-l-4 border-red-500 pl-3">💬 5. Reflection, Discussion & Commitment (5 mins)</h5>
                <p className="font-semibold text-gray-800 mb-1">Discussion Questions:</p>
                <ul className="list-disc list-inside ml-4">
                    <li>Does your church have an updated membership database?</li>
                    <li>How can you make membership more relational and less administrative?</li>
                    <li>What one improvement will you implement in your department this month?</li>
                </ul>
                <p className="italic text-sm text-red-600 mt-3">Commitment Prayer: “Lord, help me to value every member You’ve entrusted to my care. Give me wisdom to build systems that nurture, protect, and grow Your flock.”</p>
            </div>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">🏁 Summary Key Takeaways</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Church membership is both a covenant relationship and an <strong>administrative responsibility</strong>.</li>
                <li>Effective management ensures care, growth, and accountability.</li>
                <li>Systems don’t replace shepherding—they <strong>strengthen</strong> it.</li>
                <li>Healthy churches track, teach, and tend their members consistently.</li>
            </ul>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">📚 Scriptures for Further Study</h4>
            <p>Acts 2:41–47, Romans 12:4–8, Ephesians 4:11–16, Hebrews 13:17, John 10:11–16, 1 Corinthians 12:12–27</p>
        </div>
    );
}
