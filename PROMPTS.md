# Project Development Chronicle: Summit Navigator

This document outlines the key stages of development for the Summit Navigator application, including the user prompts and the work that was done in response.

---

### Stage 1: Dynamic Login/Logout Button

-   **Prompt**: "when already logged in the login button on the dashboard should be 'log out'"
-   **Work Done**:
    -   Modified `src/components/dashboard/header.tsx`.
    -   Used the `useUser` hook to get the current authentication state.
    -   Implemented conditional logic to render a "Logout" button with a `signOut` function if a non-anonymous user is detected, and a "Login" link otherwise.

---

### Stage 2: Firestore Permissions Debugging (Multiple Attempts)

-   **Prompts**: A series of prompts related to fixing "FirebaseError: Missing or insufficient permissions" on a `list` operation, including suggestions to restart the server and providing corrected rule snippets.
-   **Work Done**:
    -   Made multiple, unsuccessful attempts to modify `firestore.rules`.
    -   The core issue was a misunderstanding of how Firestore Security Rules handle collection-level `list` operations versus document-level `get` operations.
    -   Attempts included granting access to `/questions/{questionId}` and later `/sessions/{sessionId}/questions/{questionId}`, none of which resolved the `list` denial.

---

### Stage 3: Pivoting to Open Access & Anonymous Auth

-   **Prompt**: "let's allow free authentication to access dashboard and ask questions and see questions. But keep the UI"
-   **Work Done**:
    -   Modified `src/firebase/auth/use-user.tsx` to automatically sign in users anonymously if they are not already logged in.
    -   Removed UI-based redirects and prompts that blocked anonymous users from accessing the dashboard and session pages.
    -   Attempted another `firestore.rules` update to grant access to authenticated (including anonymous) users, which still failed due to the underlying rule structure issue.

---

### Stage 4: Switching Q&A to Local Storage

-   **Prompt**: "Still not working so let's use 'local storage' for the questions"
-   **Work Done**:
    -   This was a major pivot to bypass the persistent Firestore issues and make the feature functional.
    -   Refactored `src/components/session/q-and-a.tsx` completely.
    -   Removed all Firestore-related hooks and logic (`useCollection`, `addDoc`, etc.).
    -   Implemented state management using `useState` and `useEffect`.
    -   Created helper functions to read from and write to the browser's `localStorage`, ensuring data persistence across page reloads. The key for storage was made dynamic based on the `sessionId`.

---

### Stage 5: Enhancing the Q&A Component

-   **Prompt**: "All the copy of all questions to avoid for redundancy, a copy question button or check box. also add questions counter. Let's mark answered questions. Let all persist"
-   **Work Done**:
    -   Further iterated on the local storage-based Q&A component in `src/components/session/q-and-a.tsx`.
    -   **Copy Button**: Added a `Copy` icon to each question. On click, it uses the `navigator.clipboard` API to copy the question text and shows a toast notification for feedback.
    -   **Question Counter**: Added a `<Badge>` component to the card header to display the current number of questions (`questions.length`).
    -   **Mark as Answered**:
        -   Added an `answered` boolean field to the question object structure.
        -   Added a button to toggle this `answered` state for each question.
        -   Used `cn` utility to apply conditional styling (opacity, background color) to answered questions.
        -   Updated the sorting logic to group answered questions at the bottom of the list.
    -   **Persistence**: Ensured the new `answered` status and all other data were correctly serialized and saved to local storage with every update.

---

### Stage 6: Final Documentation

-   **Prompt**: "Write a complete Readme on the Project. Make it detail enough Right a prompt file a .md file, having the prompts used and work done stage by stage"
-   **Work Done**:
    -   Created `README.md` with a full project overview, tech stack, feature list, and setup instructions.
    -   Created this `PROMPTS.md` file to document the development journey from the initial prompt to the final state.
