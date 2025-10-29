export interface Session {
  id: number;
  time: string;
  title: string;
  speaker: string;
  content: number;
  qa: number;
  prayer: number;
  afternoon: boolean;
  summary: string;
}

export interface Speaker {
    name: string;
    role: string;
    bio: string;
    imageUrl: string;
    imageHint: string;
}

export const speakerData: Speaker[] = [
    {
        name: 'Bishop Davis Freeman',
        role: 'Visionary & Leadership Expert',
        bio: 'With over 30 years in ministry, Bishop Davis Freeman is a renowned voice on church planting and global leadership. His apostolic calling has led him to establish thriving ministries across three continents, and he specializes in casting vision that mobilizes generations for Christ.',
        imageUrl: 'https://picsum.photos/seed/speaker1/600/400',
        imageHint: 'man portrait',
    },
    {
        name: 'Omet Omeni',
        role: 'Church Operations & Strategy Consultant',
        bio: 'Omet Omeni is a leading expert in church governance and strategic planning. A certified project manager and theologian, he helps ministries build scalable systems and policies that foster sustainable growth, accountability, and operational excellence. He has consulted for over 50 growing churches.',
        imageUrl: 'https://picsum.photos/seed/speaker2/600/400',
        imageHint: 'man portrait',
    },
    {
        name: 'Dr. Richard Yeboah',
        role: 'Theologian & Stewardship Scholar',
        bio: 'Dr. Richard Yeboah is a respected theologian and author whose work focuses on Biblical economics and the theology of stewardship. As a seminary professor and advisor to non-profits, he provides profound insights on integrity, financial management, and leadership ethics.',
        imageUrl: 'https://picsum.photos/seed/speaker3/600/400',
        imageHint: 'man portrait',
    }
];

export const agendaData: Session[] = [
    { 
        id: 1, 
        time: '9:00 AM - 10:00 AM', 
        title: 'Understanding the Vision of the Church', 
        speaker: 'Bishop Davis Freeman', 
        content: 40, qa: 15, prayer: 5, afternoon: false,
        summary: 'This foundational session will articulate the core, divine mandate and long-term trajectory of the Church. Leaders will leave with a unified understanding of purpose, ensuring all local efforts align with the global vision for spiritual growth and community impact.'
    },
    { 
        id: 2, 
        time: '10:00 AM - 11:00 AM', 
        title: 'Church Strategy and Policy', 
        speaker: 'Omet Omeni', 
        content: 40, qa: 15, prayer: 5, afternoon: false,
        summary: 'An exploration of effective organizational strategies. This session covers policy development, decision-making frameworks, and establishing governance that supports rapid, sustainable growth while maintaining Biblical integrity and transparency.'
    },
    { 
        id: 3, 
        time: '11:00 AM - 12:00 PM', 
        title: 'Biblical Stewardship of Church Leaders', 
        speaker: 'Dr. Richard Yeboah', 
        content: 40, qa: 15, prayer: 5, afternoon: false,
        summary: 'Focuses on the personal and financial integrity required of leaders. We will discuss resource management, ethical handling of church finances, and the spiritual disciplines necessary for exemplary personal conduct in leadership roles.'
    },
    { 
        id: 4, 
        time: '12:45 PM - 1:45 PM', 
        title: 'Contemporary Church Methods', 
        speaker: 'Bishop Davis Freeman', 
        content: 40, qa: 15, prayer: 5, afternoon: true,
        summary: 'This session addresses adapting ministry practices to the modern era. We will look at integrating technology, optimizing digital outreach, and employing innovative methods to connect with younger generations without compromising doctrinal truth.'
    },
    { 
        id: 5, 
        time: '1:45 PM - 2:45 PM', 
        title: 'Church Service Delivery', 
        speaker: 'Omet Omeni', 
        content: 40, qa: 15, prayer: 5, afternoon: true,
        summary: 'An operational deep dive into ensuring excellence in all church services, from welcoming visitors to running effective small groups and mission projects. The goal is to maximize the spiritual impact of every interaction and program.'
    },
    { 
        id: 6, 
        time: '2:45 PM - 3:45 PM', 
        title: 'Church Membership Management', 
        speaker: 'Dr. Richard Yeboah', 
        content: 40, qa: 15, prayer: 5, afternoon: true,
        summary: 'Covers practical strategies for member assimilation, retention, and discipleship tracking. Learn tools and techniques to ensure every member feels valued, engaged, and actively growing in their faith journey within the community.'
    }
];

export const kpiData = [
  {
    title: 'Total Sessions',
    value: agendaData.length,
    borderColor: 'border-primary',
    id: 'kpi-sessions'
  },
  {
    title: 'Content Time',
    value: `${agendaData.reduce((acc, session) => acc + session.content, 0)} min`,
    borderColor: 'border-[#50E3C2]',
    id: 'kpi-content'
  },
  {
    title: 'Dedicated Q&A',
    value: `${agendaData.reduce((acc, session) => acc + session.qa, 0)} min`,
    borderColor: 'border-yellow-500',
    id: 'kpi-qa'
  },
  {
    title: 'Expert Speakers',
    value: new Set(agendaData.map(session => session.speaker)).size,
    borderColor: 'border-red-500',
    id: 'kpi-speakers'
  }
];
