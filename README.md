# Summit Navigator - Interactive Seminar Dashboard

Summit Navigator is a modern, interactive web application built with Next.js and Firebase, designed to serve as a digital guide for a leadership seminar. It provides attendees with a dynamic agenda, detailed information about sessions and speakers, and real-time engagement features.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (with App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [ShadCN/UI](https://ui.shadcn.com/)
- **Authentication**: [Firebase Authentication](https://firebase.google.com/docs/auth) (Email/Password & Anonymous)
- **AI Features**: [Genkit (via Google AI)](https://firebase.google.com/docs/genkit)
- **Data Visualization**: [Recharts](https://recharts.org/)
- **Deployment**: Firebase App Hosting

## Features

- **Interactive Dashboard**: A central hub displaying key seminar statistics (KPIs), an overview of the agenda, speaker highlights, and data visualizations on program composition.
- **Dynamic Agenda**: View morning and afternoon sessions. Click on any session to expand and see a detailed time breakdown.
- **Detailed Session Pages**: Each session has a dedicated page with a summary, speaker details, timing breakdown, and an AI-powered summary generation feature.
- **Speaker Profiles**: Click on a speaker's name or photo to view their profile, bio, and a list of all sessions they are leading.
- **AI-Powered Summaries**: On each session page, users can click a button to have Genkit generate a concise, AI-powered summary of the session's content.
- **Live Q&A Module**: Attendees can ask questions about a session, upvote questions from others, and see which questions have been answered. This feature is built using the browser's **Local Storage** for persistence and real-time feel without database dependencies.
- **User Authentication**: Supports both full registration (Email/Password) and anonymous guest access. The UI and permissions adapt based on the user's authentication state.

## Project Structure

The project follows the standard Next.js App Router structure.

```
/
├── src/
│   ├── app/                # Main application routes (pages, layouts)
│   │   ├── dashboard/      # Dashboard page
│   │   ├── session/[id]/   # Dynamic route for session details
│   │   └── ...
│   ├── components/         # Reusable React components
│   │   ├── dashboard/      # Components specific to the dashboard
│   │   ├── session/        # Components for the session detail pages
│   │   └── ui/             # ShadCN UI components
│   ├── firebase/           # Firebase configuration and custom hooks
│   ├── hooks/              # Custom React hooks (e.g., use-toast)
│   ├── lib/                # Utility functions and static data
│   └── ai/                 # Genkit flows for AI features
├── public/                 # Static assets
└── ...                     # Config files (tailwind, next, etc.)
```

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn

### Installation & Running Locally

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd <repository_name>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env.local` file in the root of the project. The Firebase configuration is handled by the framework, but other keys (like for Genkit) would go here.

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

    The application will be available at `http://localhost:9002`.

## Firebase Integration

The application leverages Firebase for key functionalities:
- **Authentication**: Manages user sign-up, login, and anonymous sessions. The `src/firebase/auth/use-user.tsx` hook provides a reactive way to get the current user state across the app.
- **Firestore (Q&A - Deprecated)**: The initial plan was to use Firestore for the Q&A feature, but due to persistent security rule challenges during development, this was pivoted to a Local Storage solution. The necessary hooks (`useCollection`, `useDoc`) and error handling infrastructure remain in the codebase for potential future use.

## Genkit AI Integration

The project uses **Genkit** to integrate with Google's Generative AI models.
- **Location**: AI flows are defined in `src/ai/flows/`.
- **Functionality**: The `generate-session-summary.ts` flow takes the session topic, speaker, and audience as input and returns a concise, three-sentence summary, which is displayed on the session detail page.
