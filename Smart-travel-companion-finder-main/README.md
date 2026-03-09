# TravelMatch — Frontend

React + TypeScript + Vite frontend for travel companion discovery, matching, real-time chat, reviews, emergency SOS, and place request workflows.

## Features

### Core
- **JWT Authentication** — Login / register flow with protected routes and automatic 401 interceptor (redirects to login on expired tokens)
- **Companion Discovery** — Weighted compatibility algorithm (destination, dates, budget, interests, travel style) with search/filter on the matches page
- **Match Management** — Connect, accept, reject, or cancel matches with enforced state transitions
- **Real-time Chat** — Polling-based messaging between accepted matches, paginated conversation history, conversation list with avatars
- **Reviews** — Rate travel companions on communication, reliability, compatibility, and overall; helpful vote system
- **Emergency SOS** — Send alerts with geolocation, severity levels, and status tracking
- **Place Requests** — Post and browse travel companion requests for specific destinations

### UX & Performance
- **Code Splitting** — All pages lazy-loaded via `React.lazy()` with a shared `PageLoader` Suspense fallback
- **Error Boundary** — Global React Error Boundary catches render crashes and shows a recovery UI
- **Skeleton Loaders** — Shimmer placeholders for match cards, conversations, reviews, and match details
- **Accessibility** — `aria-label`, `aria-expanded`, `aria-haspopup`, `role="navigation"` on interactive elements
- **Mobile-first** — Responsive layout with animated slide-down mobile menu (max-h transition), profile dropdown with fade-in animation
- **404 Page** — Catch-all route shows a friendly "page not found" with navigation back
- **Document Titles** — Each page sets `document.title` for tab identification

### Security & Quality
- **`authFetch` wrapper** — Centralized fetch with automatic `Authorization` header injection and 401 interception
- **`devLogger`** — `devLog` / `devWarn` / `devError` gated behind `import.meta.env.DEV` (zero console leaks in production)
- **Input Validation** — Frontend-side password strength checks, field constraints
- **No `alert()` / `window.confirm`** — All user feedback via inline UI
- **Zero `any` types** — Fully typed error handler and utility modules
- **Memoized Context** — `AppContext` value wrapped in `useMemo` with full dependency array to prevent unnecessary re-renders

## Tech Stack

| Package            | Version |
| ------------------ | ------- |
| React              | 19.2    |
| TypeScript         | 5.9     |
| Vite               | 7.3     |
| Tailwind CSS       | 3.4     |
| React Router DOM   | 7.13    |
| lucide-react       | 0.564   |
| date-fns           | 4.1     |
| clsx + tailwind-merge | latest |

## Run Locally

### Prerequisites
- Node.js 18+
- Backend server running on port 8000 (see [backend README](../backend/README.md))

### Steps

1. Install dependencies:

   ```bash
   npm install
   ```

2. (Optional) Configure backend API URL by creating `.env`:

   ```env
   VITE_API_BASE_URL=http://127.0.0.1:8000
   ```

3. Start dev server:

   ```bash
   npm run dev
   ```

4. Build for production:

   ```bash
   npm run build
   ```

## Authentication Flow

- Authenticates via `POST /login` (OAuth2 password form) on the FastAPI backend
- Backend **must** be running — there is no mock/offline fallback
- Registration auto-logs the user in after account creation
- JWT stored in `AuthContext`; `authFetch` attaches it to every API request
- On 401 response, the interceptor clears auth state and redirects to `/login`

## Project Structure

```
src/
├── pages/              10 route pages (lazy-loaded)
│   ├── LoginPage         Login + register form
│   ├── FindCompanionPage Discover companions + place requests
│   ├── MatchesPage       Search/filter/manage all matches
│   ├── MatchDetailsPage  Detailed match view + chat launch
│   ├── ConversationsPage List all chat conversations
│   ├── ChatPage          1-on-1 messaging (polling)
│   ├── ProfilePage       Edit profile + upload photo + change password
│   ├── ReviewsPage       Write & browse reviews
│   ├── EmergencyPage     SOS alerts dashboard
│   └── NotFoundPage      404 catch-all
├── components/         8 shared components
│   ├── Layout            Nav bar, mobile menu, profile dropdown
│   ├── ChatInterface     Message bubble list + input
│   ├── CompanionCard     User card with compatibility score
│   ├── EmergencySOS      Alert creation form
│   ├── SOSButton         Floating emergency button
│   ├── UserAvatar        Photo resolver with gender fallback
│   ├── Skeleton          Generic shimmer placeholder
│   └── MatchCardSkeleton Skeleton for companion cards
├── context/            2 React contexts
│   ├── AuthContext        JWT state, login/logout, profile update
│   └── AppContext         Matches, messages, reviews (memoized)
├── utils/              11 utility modules
│   ├── apiClient         authFetch wrapper + 20+ API functions
│   ├── devLogger         DEV-gated console logging
│   ├── photoUtils        resolvePhoto helper (local/remote/default)
│   ├── errorHandler      Typed error extraction (zero `any`)
│   ├── validation        Password strength + field validators
│   ├── emergencySOS      SOS alert helpers
│   ├── chatManager       Chat state utilities
│   ├── reviewManager     Review state utilities
│   ├── matchingAlgorithm Client-side matching helpers
│   ├── advancedMatchingAlgorithm Extended scoring logic
│   └── loadingStates     Loading state type definitions
├── types/              TypeScript interfaces
│   └── index.ts          User, Match, Message, Review, etc.
└── data/               Static reference data
    ├── destinations.ts   Destination list + images
    ├── mockTrips.ts      Sample trip data
    └── mockUsers.ts      Sample user data
```
