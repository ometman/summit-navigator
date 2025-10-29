import { type Session } from "@/lib/data";

export default function Session3Content({ session }: { session: Session }) {
    return (
        <div className="space-y-6 text-gray-700">
            <blockquote className="p-4 border-l-4 border-yellow-500 bg-yellow-50 italic rounded">
                <p className="font-bold text-lg text-yellow-800">Theme Scripture:</p>
                <p>“Moreover, it is required in stewards that one be found faithful.” — <span className="font-semibold">1 Corinthians 4:2</span></p>
            </blockquote>

            <div className="p-4 bg-gray-50 rounded-lg shadow-sm">
                <p className="text-sm font-semibold text-gray-600 mb-2">Trainer:</p>
                <p className="font-bold text-lg text-foreground">{session.speaker} (Theologian & Church Training Consultant)</p>
                <p className="text-sm font-semibold text-gray-600 mt-2">Target Audience:</p>
                <p className="text-sm">Pastors, Elders, Departmental Heads, and Ministry Leaders</p>
            </div>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">Training Objectives</h4>
            <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Understand the biblical foundation and theology of stewardship.</li>
                <li>Recognize stewardship as a leadership responsibility and kingdom calling.</li>
                <li>Evaluate how stewardship affects <strong>spiritual, financial, and organizational integrity</strong>.</li>
                <li>Develop practical systems to model faithful stewardship in their ministries.</li>
            </ul>
            
            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">⏰ Session Breakdown (40 Minutes Total)</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-sm font-medium">
                <div className="p-2 bg-blue-100 rounded">1. Intro (5 min)</div>
                <div className="p-2 bg-blue-100 rounded">2. Theology (10 min)</div>
                <div className="p-2 bg-blue-100 rounded">3. Dimensions (10 min)</div>
                <div className="p-2 bg-blue-100 rounded">4. Practice (10 min)</div>
                <div className="p-2 bg-blue-100 rounded">5. Reflection (5 min)</div>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-green-500 pl-3">🕊️ 1. Introduction & Icebreaker (5 mins)</h5>
                <p className="mb-2"><strong>Activity:</strong> Ask participants: “If God were to audit your stewardship this year—of time, money, gifts, people, and opportunities—what grade would He give you?”</p>
                <p className="italic text-sm text-gray-600">Brief Devotional Thought: Everything we have belongs to God; leadership is a trust, not ownership. (Psalm 24:1; Matthew 25:14–30)</p>
                <p className="mt-2"><strong>Set the tone:</strong> Leadership is not about possession, but about <strong>responsibility</strong>. God calls leaders to faithfulness, accountability, and fruitfulness.</p>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-green-500 pl-3">📖 2. The Theology of Stewardship (10 mins)</h5>
                <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Definition:</strong> Stewardship is the divine entrustment of God’s resources to humanity for faithful management and fruitful multiplication.</li>
                    <li><strong>Biblical Basis:</strong> Genesis 1:28 (Dominion mandate), Psalm 24:1 (Ownership), Matthew 25:14–30 (Accountability), Luke 16:10–12 (Faithfulness).</li>
                    <li><strong>Theological Insight:</strong> Stewardship flows from three core truths: God is Owner, Man is Manager, Accountability is certain.</li>
                    <li><strong>Leadership Application:</strong> Every leader is a trustee of God’s people, resources, and vision. <strong>Faithful stewardship</strong> proves spiritual maturity more than giftedness does.</li>
                </ul>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-green-500 pl-3">🌱 3. The Dimensions of Biblical Stewardship (10 mins)</h5>
                <ul className="list-disc list-inside space-y-3 ml-4">
                    <li><strong>Life and Time:</strong> Leaders must schedule prayer, study, and ministry wisely. Time wasted is destiny delayed. (Ephesians 5:15–16)</li>
                    <li><strong>Gifts and Calling:</strong> Use your anointing and abilities for the edification of the body. Guard against neglect or pride. (1 Peter 4:10)</li>
                    <li><strong>Relationships and People:</strong> Pastoral relationships are sacred trusts. Leaders watch over souls as those who must give account. (Hebrews 13:17)</li>
                    <li><strong>Finances and Possessions:</strong> Leaders must model integrity. Stewardship requires <strong>systems</strong>—budgets, reports, and audits. (Luke 16:10–12)</li>
                    <li><strong>Vision and Mission:</strong> Stay focused on God’s purpose, not personal ambition. Guard the purity of the vision from compromise.</li>
                </ul>
            </div>

            <div className="pt-4">
                <h5 className="text-lg font-extrabold text-foreground mb-2 border-l-4 border-green-500 pl-3">⚙️ 4. Stewardship in Church Leadership Practice (10 mins)</h5>
                <div className="space-y-2">
                    <p className="font-semibold text-gray-800">A. Spiritual Stewardship:</p>
                    <p className="ml-4">Pray for discernment. Lead from the overflow of your private devotion.</p>
                    <p className="font-semibold text-gray-800">B. Administrative Stewardship:</p>
                    <p className="ml-4">Build systems that ensure accountability and excellence (transparent reporting). Steward data, assets, and properties with diligence.</p>
                    <p className="font-semibold text-gray-800">C. Relational Stewardship:</p>
                    <p className="ml-4">Mentor younger leaders to multiply leadership. Handle conflicts with grace.</p>
                    <p className="font-semibold text-gray-800">D. Community Stewardship:</p>
                    <p className="ml-4">Practice social responsibility (education, justice). Be salt and light. (Matthew 5:13–16)</p>
                    <p className="font-semibold text-gray-800">E. Legacy Stewardship:</p>
                    <p className="ml-4">Think generationally. Entrust to faithful men who will teach others also. (2 Timothy 2:2).</p>
                </div>
            </div>

            <div className="pt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <h5 className="text-lg font-extrabold text-red-800 mb-2 border-l-4 border-red-500 pl-3">💬 5. Reflection, Discussion & Commitment (5 mins)</h5>
                <p className="font-semibold text-gray-800 mb-1">Group Reflection Questions:</p>
                <ul className="list-disc list-inside ml-4">
                    <li>Which area of stewardship do you personally struggle with most?</li>
                    <li>What one practical step will you take this week to improve your stewardship?</li>
                    <li>How can your department or ministry model better accountability and faithfulness?</li>
                </ul>
                <p className="italic text-sm text-red-600 mt-3">Commitment Prayer: “Lord, make me a faithful steward—of Your Word, Your people, Your time, and Your resources. May I lead with integrity and serve with eternity in view.”</p>
            </div>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">🏁 Summary Key Takeaways</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Stewardship = Ownership by God + Responsibility by man + Accountability before God.</li>
                <li><strong>Faithfulness</strong> is greater than fruitfulness.</li>
                <li>Leadership stewardship affects the <strong>health and witness</strong> of the Church.</li>
                <li>Stewardship is worship—how we handle what God entrusts reflects how we honor Him.</li>
            </ul>

            <h4 className="text-xl font-bold text-primary border-b pb-1 mt-6">📚 Recommended Scriptures for Further Study</h4>
            <p>Genesis 1:26–28, 1 Corinthians 4:1–2, Luke 19:12–26, Matthew 6:19–21, Romans 12:6–8, 1 Peter 4:10–11</p>
        </div>
    );
}
