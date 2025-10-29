import { type Session } from "@/lib/data";

export default function Session4Content({ session }: { session: Session }) {
    return (
        <div className="space-y-6 text-gray-700">
            <blockquote className="p-4 border-l-4 border-purple-500 bg-purple-50 italic rounded">
                <p className="font-bold text-lg text-purple-800">Theme Scripture:</p>
                <p>“I have become all things to all people so that by all possible means I might save some.” — <span className="font-semibold">1 Corinthians 9:22</span></p>
            </blockquote>

            <div className="p-4 bg-gray-50 rounded-lg shadow-sm">
                <p className="text-sm font-semibold text-gray-600 mb-2">Trainer:</p>
                <p className="font-bold text-lg text-foreground">{session.speaker}</p>
                <p className="text-sm font-semibold text-gray-600 mt-2">Target Audience:</p>
                <p className="text-sm">Pastors, Departmental Heads, Worship Teams, and Church Growth Strategists</p>
            </div>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">Training Objectives</h4>
            <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Understand biblical principles that guide contemporary ministry methods.</li>
                <li>Learn practical strategies for attracting and retaining people in a modern church context.</li>
                <li>Discover creative ways to make church life more exciting, engaging, and spiritually fulfilling.</li>
                <li>Identify ways to increase member participation and commitment.</li>
            </ul>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">⏰ Session Breakdown (40 Minutes Total)</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-sm font-medium">
                <div className="p-2 bg-purple-100 rounded">1. Intro (5 min)</div>
                <div className="p-2 bg-purple-100 rounded">2. Theology (10 min)</div>
                <div className="p-2 bg-purple-100 rounded">3. Methods (10 min)</div>
                <div className="p-2 bg-purple-100 rounded">4. Commitment (10 min)</div>
                <div className="p-2 bg-purple-100 rounded">5. Discussion (5 min)</div>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-purple-500 pl-3">🌟 1. Introduction & Icebreaker (5 mins)</h5>
                <p className="mb-2"><strong>Activity:</strong> Ask: “When was the last time you were truly excited to attend a church service—and what made it special?”</p>
                <p className="mb-2">Encourage a few responses, then emphasize: The church experience must be spiritually deep yet culturally relatable. The challenge is not just to fill seats, but to form disciples who love being part of what God is doing.</p>
                <p className="italic text-sm text-gray-600">Mini-Devotional Thought: Matthew 5:14–16 — “You are the light of the world.” Light must shine where people are. The church must be visible, vibrant, and relevant.</p>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-purple-500 pl-3">📖 2. The Theology of Contemporary Ministry (10 mins)</h5>
                <p className="font-semibold text-gray-800">A. Biblical Foundations</p>
                <p className="ml-4">The message is eternal; the methods must evolve. Jesus used stories (parables), meals, and community spaces — He met people where they were. 1 Corinthians 9:22 — Paul adjusted his approach to reach different groups without compromising the message.</p>
                <p className="font-semibold text-gray-800 mt-2">B. The Mission Mandate</p>
                <p className="ml-4">Matthew 28:19–20 — “Go and make disciples…” The Great Commission is a “go” command, not a “wait for them to come” command. Luke 14:23 — “Go out to the highways and compel them to come in.”</p>
                <p className="font-semibold text-gray-800 mt-2">C. The Contemporary Context</p>
                <p className="ml-4">Today’s world is digital, fast-paced, and experience-driven. People seek meaning, belonging, and authenticity. Churches must blend spiritual depth with cultural awareness.</p>
                <p className="font-semibold text-gray-800 mt-2">D. Theological Insight</p>
                <p className="ml-4">Contemporary methods are not compromise — they are contextualization of the gospel. Faithfulness to God’s message requires relevance to people’s world.</p>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-purple-500 pl-3">🎯 3. Methods for Attracting and Engaging People (10 mins)</h5>
                <p className="font-semibold text-gray-800">A. Build an Inviting Culture</p>
                <p className="ml-4">Make everyone who walks in feel seen, valued, and loved. Train ushers and greeters to express genuine warmth. Hospitality is evangelism in practice.</p>
                <p className="font-semibold text-gray-800 mt-2">B. Develop a Strong Online Presence</p>
                <p className="ml-4">Use social media (Facebook, Instagram, YouTube, TikTok) to tell your church story. Stream services with excellence; post short devotionals, testimonies, and highlights. Maintain a clean, updated website with event details and contact info.</p>
                <p className="font-semibold text-gray-800 mt-2">C. Create Relevant and Engaging Worship Experiences</p>
                <p className="ml-4">Worship should be heartfelt, excellent, and spirit-led. Incorporate creativity — drama, testimonies, media, visuals. Use contemporary music and sound without losing spiritual authenticity.</p>
                <p className="font-semibold text-gray-800 mt-2">D. Teach Practical, Life-Applicable Messages</p>
                <p className="ml-4">Connect the Bible to real issues: relationships, finances, purpose, mental health. People are attracted to truth that transforms life, not just theory. Sermons should answer: “How does this help me follow Jesus today?”</p>
                <p className="font-semibold text-gray-800 mt-2">E. Community and Outreach Engagement</p>
                <p className="ml-4">Host events that meet community needs: health drives, youth summits, empowerment workshops. Partner with local schools, NGOs, and neighborhood initiatives. Let your church be known for doing good.</p>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-purple-500 pl-3">🔥 4. Increasing Commitment and Participation (10 mins)</h5>
                <p className="font-semibold text-gray-800">A. Discipleship Pathway</p>
                <p className="ml-4">Define a clear spiritual growth journey: Visitor → Member → Disciple → Worker → Leader. Offer consistent discipleship classes and mentorship programs.</p>
                <p className="font-semibold text-gray-800 mt-2">B. Ministry Involvement</p>
                <p className="ml-4">Encourage every member to serve in at least one area of ministry. Help them discover their gifts and deploy them (Romans 12:6–8). Recognize and celebrate volunteers publicly.</p>
                <p className="font-semibold text-gray-800 mt-2">C. Create a Sense of Belonging</p>
                <p className="ml-4">Build smaller groups (cell groups, fellowships, or ministries) for deeper relationships. Encourage “family moments” — shared meals, team prayers, testimonies. Use member appreciation days or impact stories to reinforce belonging.</p>
                <p className="font-semibold text-gray-800 mt-2">D. Communication and Feedback</p>
                <p className="ml-4">Keep communication open and transparent. Listen to member feedback on how to improve worship and ministries. Use digital surveys, suggestion boxes, or leadership listening sessions.</p>
                <p className="font-semibold text-gray-800 mt-2">E. Make Church Exciting Yet Purposeful</p>
                <p className="ml-4">Plan engaging sermon series (themes like Faith in Real Life, Winning at Work, Relationships 101). Introduce themed Sundays (Youth Takeover, Family Sunday, Community Sunday). Use visuals, storytelling, and testimonies to connect emotionally.</p>
                 <p className="font-semibold text-gray-800 mt-2">F. Leadership Modeling</p>
                <p className="ml-4">Passion and participation flow from the top. When leaders are visibly committed, members follow. Leaders must embody joy, consistency, and authenticity in ministry.</p>
            </div>

            <div className="pt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <h5 className="text-lg font-extrabold text-red-800 mb-2 border-l-4 border-red-500 pl-3">💬 5. Discussion & Commitment Prayer (5 mins)</h5>
                <p className="font-semibold text-gray-800 mb-1">Reflection Questions:</p>
                <ul className="list-disc list-inside ml-4">
                    <li>What makes a church exciting without being worldly?</li>
                    <li>What one new method can your team implement to improve engagement?</li>
                    <li>How can you inspire your members to participate more actively?</li>
                </ul>
                <p className="italic text-sm text-red-600 mt-3">Commitment Prayer: “Lord, make our church a place of life, love, and relevance. Help us to reach our generation with creative methods, deep truth, and enduring passion. Let our ministries attract souls and transform lives, for Your glory.”</p>
            </div>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">🏁 Summary Key Takeaways</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
                <li>The message remains the same, but the methods must speak the language of the generation.</li>
                <li>A growing church is intentional about experience, connection, and discipleship.</li>
                <li>Attracting people starts with authentic relationships, not flashy programs.</li>
                <li>Excitement comes from purposeful engagement, not performance.</li>
                <li>Commitment grows when members feel valued, involved, and spiritually fed.</li>
            </ul>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">📚 Recommended Scriptures for Further Study</h4>
            <p>Matthew 28:18–20, Acts 2:41–47, 1 Corinthians 9:19–23, Romans 12:6–8, Matthew 5:14–16, Colossians 3:23–24</p>
        </div>
    );
}
