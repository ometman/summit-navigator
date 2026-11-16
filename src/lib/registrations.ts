export type RegistrationStatus = 'Confirmed' | 'Pending Verification' | 'Checked In';

export type RegistrationTrack = 'Morning & Afternoon' | 'Morning Track' | 'Afternoon Track';

export type RegistrationSource = 'Web Registration' | 'Direct Invite' | 'Ministry Partner';

export interface UserRegistration {
  id: string;
  fullName: string;
  email: string;
  organization: string;
  role: string;
  track: RegistrationTrack;
  source: RegistrationSource;
  status: RegistrationStatus;
  registeredAt: string;
}

export const REGISTRATIONS_STORAGE_KEY = 'summit_user_registrations_v1';

export const initialRegistrations: UserRegistration[] = [
  {
    id: 'reg-101',
    fullName: 'Grace Adeyemi',
    email: 'grace.adeyemi@harvesthouse.org',
    organization: 'Harvest House International',
    role: 'Ministry Lead',
    track: 'Morning & Afternoon',
    source: 'Web Registration',
    status: 'Checked In',
    registeredAt: '2026-11-13T07:45:00.000Z',
  },
  {
    id: 'reg-102',
    fullName: 'Daniel Mensah',
    email: 'd.mensah@covenantchapel.org',
    organization: 'Covenant Chapel',
    role: 'Senior Pastor',
    track: 'Morning & Afternoon',
    source: 'Direct Invite',
    status: 'Checked In',
    registeredAt: '2026-11-13T06:20:00.000Z',
  },
  {
    id: 'reg-103',
    fullName: 'Hannah Boateng',
    email: 'hannah@livingwordcenter.org',
    organization: 'Living Word Center',
    role: 'Operations & Strategy',
    track: 'Morning & Afternoon',
    source: 'Web Registration',
    status: 'Confirmed',
    registeredAt: '2026-11-13T02:15:00.000Z',
  },
  {
    id: 'reg-104',
    fullName: 'Samuel Osei',
    email: 'samuel.osei@kingdombuilders.org',
    organization: 'Kingdom Builders Assembly',
    role: 'Youth & Outreach',
    track: 'Afternoon Track',
    source: 'Web Registration',
    status: 'Confirmed',
    registeredAt: '2026-11-12T21:10:00.000Z',
  },
  {
    id: 'reg-105',
    fullName: 'Miriam Nwosu',
    email: 'mnwosu@gracefellowship.net',
    organization: 'Grace Fellowship',
    role: 'Ministry Lead',
    track: 'Morning & Afternoon',
    source: 'Ministry Partner',
    status: 'Pending Verification',
    registeredAt: '2026-11-12T17:35:00.000Z',
  },
  {
    id: 'reg-106',
    fullName: 'Caleb Okonkwo',
    email: 'caleb@newlifechurch.org',
    organization: 'New Life Community Church',
    role: 'Operations & Strategy',
    track: 'Morning Track',
    source: 'Web Registration',
    status: 'Checked In',
    registeredAt: '2026-11-12T14:50:00.000Z',
  },
  {
    id: 'reg-107',
    fullName: 'Esther Kwarteng',
    email: 'esther.k@citylightministry.org',
    organization: 'City Light Ministry',
    role: 'Volunteer Coordinator',
    track: 'Morning & Afternoon',
    source: 'Web Registration',
    status: 'Confirmed',
    registeredAt: '2026-11-11T19:05:00.000Z',
  },
  {
    id: 'reg-108',
    fullName: 'Joshua Appiah',
    email: 'j.appiah@redeemedassembly.org',
    organization: 'Redeemed Assembly',
    role: 'Senior Pastor',
    track: 'Morning & Afternoon',
    source: 'Direct Invite',
    status: 'Confirmed',
    registeredAt: '2026-11-11T11:25:00.000Z',
  },
  {
    id: 'reg-109',
    fullName: 'Deborah Balogun',
    email: 'deborah@faithanchor.org',
    organization: 'Faith Anchor Ministries',
    role: 'Youth & Outreach',
    track: 'Afternoon Track',
    source: 'Web Registration',
    status: 'Pending Verification',
    registeredAt: '2026-11-10T16:40:00.000Z',
  },
  {
    id: 'reg-110',
    fullName: 'Nathaniel Asante',
    email: 'nathaniel@cornerstonehub.org',
    organization: 'Cornerstone Hub',
    role: 'Operations & Strategy',
    track: 'Morning & Afternoon',
    source: 'Ministry Partner',
    status: 'Confirmed',
    registeredAt: '2026-11-10T09:15:00.000Z',
  },
  {
    id: 'reg-111',
    fullName: 'Ruth Owusu',
    email: 'ruth.owusu@betheloutreach.org',
    organization: 'Bethel Outreach',
    role: 'Ministry Lead',
    track: 'Morning Track',
    source: 'Web Registration',
    status: 'Confirmed',
    registeredAt: '2026-11-09T15:30:00.000Z',
  },
  {
    id: 'reg-112',
    fullName: 'Timothy Adebayo',
    email: 'timothy@zionfellowship.org',
    organization: 'Zion Fellowship',
    role: 'Senior Pastor',
    track: 'Morning & Afternoon',
    source: 'Direct Invite',
    status: 'Checked In',
    registeredAt: '2026-11-08T13:10:00.000Z',
  },
  {
    id: 'reg-113',
    fullName: 'Abigail Darko',
    email: 'abigail@hopechapel.org',
    organization: 'Hope Chapel',
    role: 'Volunteer Coordinator',
    track: 'Afternoon Track',
    source: 'Web Registration',
    status: 'Confirmed',
    registeredAt: '2026-11-07T18:20:00.000Z',
  },
  {
    id: 'reg-114',
    fullName: 'Peter Eze',
    email: 'peter.eze@victorytabernacle.org',
    organization: 'Victory Tabernacle',
    role: 'Operations & Strategy',
    track: 'Morning & Afternoon',
    source: 'Ministry Partner',
    status: 'Confirmed',
    registeredAt: '2026-11-04T10:00:00.000Z',
  },
];

export function mergeRegistrations(
  primary: UserRegistration[],
  secondary: UserRegistration[]
): UserRegistration[] {
  const map = new Map<string, UserRegistration>();
  for (const item of secondary) {
    map.set(item.id, item);
  }
  for (const item of primary) {
    map.set(item.id, item);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
  );
}

export function registrationsToCsv(rows: UserRegistration[]): string {
  const headers = [
    'ID',
    'Full Name',
    'Email',
    'Organization',
    'Role',
    'Track',
    'Source',
    'Status',
    'Registered At',
  ];

  const escapeCell = (value: string) => {
    const safe = value.replace(/"/g, '""');
    return `"${safe}"`;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) =>
      [
        row.id,
        row.fullName,
        row.email,
        row.organization,
        row.role,
        row.track,
        row.source,
        row.status,
        row.registeredAt,
      ]
        .map(escapeCell)
        .join(',')
    ),
  ];

  return lines.join('\n');
}
