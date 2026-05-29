# FA CRM — Codebase Rundown

## Overview

FA CRM is a Financial Advisor Client Relationship Management web app built with **Next.js 16 (App Router)**, **Firebase (Auth + Firestore)**, **React 19**, and **Tailwind CSS v4**. It is a mobile-first PWA-style app with a bottom nav on mobile and a collapsible sidebar on desktop.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| UI Library | React 19.2.4 |
| Styling | Tailwind CSS v4 |
| Backend/DB | Firebase Firestore (NoSQL) |
| Auth | Firebase Authentication (email/password) |
| Icons | react-icons v5 |
| Messaging | External BulkMessenger service at `localhost:8080` |

---

## Directory Structure

```
crm-app/
├── app/                     # Next.js App Router pages
│   ├── layout.js            # Root layout (providers)
│   ├── page.js              # Dashboard (/)
│   ├── login/page.js        # Login
│   ├── clients/page.js      # Client list
│   ├── add-client/page.js   # Add client form
│   ├── client/[id]/page.js  # Client detail + meetings
│   ├── follow-ups/page.js   # Follow-up queue
│   ├── calendar/page.js     # Meeting calendar
│   ├── messaging/page.js    # Bulk messaging
│   ├── groups/page.js       # Messaging groups
│   ├── settings/page.js     # User settings
│   └── admin/
│       ├── page.js          # Admin dashboard
│       └── users/page.js    # Admin user list
├── components/              # Shared UI components
│   ├── PageShell.js
│   ├── BottomNav.js
│   ├── SideNav.js
│   ├── AdminBottomNav.js
│   ├── AdminPageShell.js
│   ├── ClientCard.js
│   ├── SearchBar.js
│   └── Spinner.js
├── context/
│   ├── AuthContext.js       # Firebase auth + user profile state
│   └── SidebarContext.js    # Sidebar collapsed/expanded state
├── hooks/
│   └── useRequireAuth.js    # Auth guard hook
├── lib/
│   ├── firebase.js          # Firebase app init
│   ├── firestore.js         # All Firestore CRUD functions
│   └── notifications.js     # Browser Notification API helpers
└── config/
    └── app.js               # App-wide constants
```

---

## Firestore Collections & Schemas

### `users/{uid}`
Keyed by Firebase Auth UID.

| Field | Type | Description |
|---|---|---|
| `name` | string | Display name |
| `email` | string | Email address |
| `role` | `"User"` \| `"Admin"` | Access level |
| `followUpDays` | number | Global follow-up interval (default: 7) |
| `inactivityCheckDays` | number | Inactivity alert threshold (default: 30) |
| `customMilestones` | string[] | User-defined milestone labels |
| `createdAt` | Timestamp | Server timestamp on creation |

### `clients/{id}`
Auto-ID. Scoped to a user via `assignedTo`.

| Field | Type | Description |
|---|---|---|
| `name` | string | Client full name |
| `contactType` | `"Telegram"` \| `"Email"` \| `"Instagram"` | Channel type |
| `contact` | string | Handle/email for that channel |
| `status` | `"Prospect"` \| `"Warm Lead"` \| `"Strong Client"` \| `"Client"` | Pipeline stage |
| `notes` | string | Free-text notes |
| `followUpDays` | number \| null | Per-client override (null = use user default) |
| `scheduledFollowUpAt` | Timestamp \| null | Specific date to follow up |
| `lastContactedAt` | Timestamp \| null | Last time "Mark as Contacted" was pressed |
| `milestones` | `{ [name]: boolean }` | Checked state for each custom milestone |
| `archived` | boolean | Soft-delete flag |
| `assignedTo` | string (uid) | Owning user |
| `createdAt` | Timestamp | Server timestamp |

### `meetings/{id}`
Auto-ID. Scoped to a user via `assignedTo`.

| Field | Type | Description |
|---|---|---|
| `clientId` | string | Reference to a client doc ID |
| `clientName` | string | Denormalized client name for display |
| `date` | Timestamp | Meeting date/time |
| `notes` | string | Pre-meeting discussion notes |
| `nextActions` | string | Actions to take before next meeting |
| `completed` | `true` \| `false` \| `null` | `null` = unconfirmed past meeting |
| `assignedTo` | string (uid) | Owning user |
| `createdAt` | Timestamp | Server timestamp |

**Note:** `completed` is automatically set to `true` if `date` is in the past at creation time.

### `messagingGroups/{id}`
Auto-ID. Scoped to a user via `assignedTo`.

| Field | Type | Description |
|---|---|---|
| `name` | string | Group display name |
| `description` | string | Optional description |
| `clientIds` | string[] | Array of client doc IDs |
| `assignedTo` | string (uid) | Owning user |
| `createdAt` | Timestamp | Server timestamp |

### `messageTemplates/{id}`
Auto-ID. Scoped to a user via `assignedTo`.

| Field | Type | Description |
|---|---|---|
| `name` | string | Template display name |
| `body` | string | Message body with `{{variable}}` placeholders |
| `variables` | string[] | Extracted variable names (e.g. `["name", "telegram"]`) |
| `assignedTo` | string (uid) | Owning user |
| `createdAt` | Timestamp | Server timestamp |

---

## App Constants (`config/app.js`)

| Export | Value | Description |
|---|---|---|
| `CLIENT_STATUSES` | `["Prospect", "Warm Lead", "Strong Client", "Client"]` | Pipeline stages in order |
| `STATUS_STYLES` | `{ [status]: "bg-... text-..." }` | Tailwind classes per status badge |
| `STATUS_COLORS` | `{ [status]: "bg-..." }` | Dot/bar colour per status |
| `CONTACT_TYPES` | `["Telegram", "Email", "Instagram"]` | Supported contact channels |
| `USER_ROLES` | `["User", "Admin"]` | Role options |
| `DEFAULT_FOLLOW_UP_DAYS` | `7` | Fallback follow-up interval |
| `DEFAULT_INACTIVITY_DAYS` | `30` | Fallback inactivity threshold |

---

## Firebase Layer (`lib/`)

### `lib/firebase.js`
Initialises the Firebase app (singleton pattern via `getApps()` guard).

Exports:
- `auth` — Firebase Auth instance
- `db` — Firestore instance
- `firebaseConfig` — config object (placeholder values, must be replaced)

### `lib/firestore.js`
All database operations. Every function is `async` and returns plain objects (Firestore doc data spread with `id`).

#### Users
| Function | Signature | Description |
|---|---|---|
| `addUserProfile` | `(uid, data) → void` | `setDoc` — creates or overwrites a user doc |
| `getUserProfile` | `(uid) → obj \| null` | Fetch single user by UID |
| `getAllUsers` | `() → obj[]` | Fetch all users (Admin only, no filter) |
| `updateUserProfile` | `(uid, data) → void` | Partial update via `updateDoc` |
| `deleteUserProfile` | `(uid) → void` | Hard delete user doc |

#### Clients
| Function | Signature | Description |
|---|---|---|
| `addClient` | `(data) → id` | `addDoc` with `createdAt` timestamp, returns new doc ID |
| `getClient` | `(id) → obj \| null` | Fetch single client |
| `updateClient` | `(id, data) → void` | Partial update |
| `deleteClient` | `(id) → void` | Hard delete |
| `getClientsByAssignee` | `(uid) → obj[]` | Query by `assignedTo`, ordered by `createdAt desc`, filters out archived |
| `getArchivedClientsByAssignee` | `(uid) → obj[]` | Same query, filters only `archived === true` |

#### Meetings
| Function | Signature | Description |
|---|---|---|
| `addMeeting` | `(data) → id` | Converts `data.date` string → `Timestamp`, auto-sets `completed: true` if date is past |
| `getMeetingsByAssignee` | `(uid) → obj[]` | Query by `assignedTo`, ordered by `date asc` |
| `getMeetingsByClient` | `(clientId) → obj[]` | Query by `clientId`, ordered by `date asc` |
| `updateMeeting` | `(id, data) → void` | Partial update; converts `data.date` string → `Timestamp` if present |
| `deleteMeeting` | `(id) → void` | Hard delete |

#### Messaging Groups
| Function | Signature | Description |
|---|---|---|
| `addMessagingGroup` | `(data) → id` | Creates group with empty `clientIds` default |
| `getMessagingGroupsByAssignee` | `(uid) → obj[]` | Query by `assignedTo`, ordered by `createdAt desc` |
| `getMessagingGroup` | `(id) → obj \| null` | Fetch single group |
| `updateMessagingGroup` | `(id, data) → void` | Partial update (used to set `clientIds`) |
| `deleteMessagingGroup` | `(id) → void` | Hard delete |

#### Message Templates
| Function | Signature | Description |
|---|---|---|
| `addMessageTemplate` | `(data) → id` | Creates template; caller is expected to pass `variables` array |
| `getMessageTemplatesByAssignee` | `(uid) → obj[]` | Query by `assignedTo`, ordered by `createdAt desc` |
| `updateMessageTemplate` | `(id, data) → void` | Partial update |
| `deleteMessageTemplate` | `(id) → void` | Hard delete |

### `lib/notifications.js`
Browser Notification API helpers.

| Function | Signature | Description |
|---|---|---|
| `requestNotificationPermission` | `() → boolean` | Requests permission if not yet granted; returns `true` if granted |
| `showOverdueNotification` | `(count) → void` | Fires a browser notification "FA CRM — Follow-ups Due" with `count` |

---

## Auth & Context

### `context/AuthContext.js`
Provides global auth state via React Context.

**State:**
- `user` — Firebase Auth user object (or `null`)
- `profile` — Firestore user profile doc (or `null`)
- `loading` — true until `onAuthStateChanged` fires
- `needsSetup` — true if authenticated but no Firestore profile exists

**Flow on auth state change:**
1. `onAuthStateChanged` fires → sets `user`
2. If user exists → `getUserProfile(uid)` → sets `profile` or `needsSetup = true`
3. If user is null → clears `profile` and `needsSetup`

**Exposed via `useAuth()` hook:**
`{ user, profile, loading, needsSetup, setProfile, setNeedsSetup }`

### `context/SidebarContext.js`
Simple boolean toggle context for the desktop sidebar collapsed/expanded state.

**Exposed via `useSidebar()` hook:**
`{ collapsed: boolean, toggle: () => void }`

### `hooks/useRequireAuth.js`
Auth guard — redirects to `/login` if `user` is null after loading completes.

Returns: `{ user, profile, loading }` — same as `useAuth()`.

---

## Pages & Flows

### `/login` — Login Page
**Flow:**
1. User submits email + password form
2. `signInWithEmailAndPassword(auth, email, password)`
3. `getUserProfile(uid)` — if profile missing, shows error "Contact your admin"
4. Redirects to `/admin` if `role === "Admin"`, else `/`

### `/` — Dashboard
**Data loaded:** all non-archived clients for user + all meetings for user (in parallel).

**Key functions:**

`daysSince(date)` → number of full days elapsed since a Date.

`getRefDate(client)` → returns the best reference date for follow-up calculation:
- `lastContactedAt` → `createdAt` → raw `createdAt` → `null`

`getScheduledDate(client)` → converts `scheduledFollowUpAt` Firestore Timestamp or plain date to JS Date.

`getOverdueClients(clients, followUpDays, inactivityDays)` → filters clients into overdue list using two conditions:
- **Type 1** (never contacted): `daysSinceCreated >= followUpInterval`
- **Type 2** (inactive): `daysSinceLastContact >= inactivityDays`
- **Scheduled**: `scheduledFollowUpAt <= today`

Sorted by most days since reference date (descending).

`getPeriodStart(period)` → returns start of "Daily" (today midnight), "Weekly" (last Monday), or `null` for "All Time".

`StatCard({ label, value, loading })` → display card component for metrics.

`handleTexted(client)` → marks a client as contacted: calls `updateClient(id, { lastContactedAt: serverTimestamp() })`, optimistically updates local state.

**Rendered sections:**
- Shortcut buttons → Calendar, Follow-ups (with badge), Messaging
- Overdue follow-ups list (up to 5, with "See all" link)
- Today's meetings / Upcoming meetings (max 3)
- Period selector (Daily / Weekly / All Time)
- Stats grid (Total Clients + per-status counts + meeting count)
- Pipeline progress bars per status

### `/clients` — Client List

**State:** active clients list, archived clients list, search string, active status chip filter, advanced filters (contactType, status), select mode, selected IDs set.

**Functions:**

`FilterSelect` — reusable select dropdown component.

`toggleSelect(client)` → adds/removes client ID from `selectedIds` Set.

`handleBulkArchive()` → calls `updateClient(id, { archived: true })` for all selected IDs in parallel, then refreshes both lists.

**Filtering logic** (applied in order):
1. Switch between active/archived pool
2. Filter by quick status chip (`activeStatus`)
3. Filter by advanced filter panel (`contactType`, `status`)
4. Filter by search string (case-insensitive `name` match)

### `/add-client` — Add Client Form
Wrapped in `<Suspense>` (for `useSearchParams` compatibility).

**Form fields:** name, contactType, contact, status, followUpDays (optional), notes.

**`handleSubmit`:**
- Validates name + contact are non-empty
- Calls `addClient({ ...form, assignedTo: uid, milestones: {}, archived: false })`
- Redirects to `/client/{newId}`

### `/client/[id]` — Client Detail

**Two tabs:** `info` and `meetings` (meetings fetched lazily on first tab switch).

**Info tab functions:**

`handleSave()` → `updateClient(id, { ...form })` — saves all editable fields including `scheduledFollowUpAt` (converted to Firestore Timestamp if it's a JS Date).

`handleMarkContacted()` → `updateClient(id, { lastContactedAt: serverTimestamp(), scheduledFollowUpAt: null })` — stamps contact time and clears any scheduled follow-up.

`handleArchive()` / `handleUnarchive()` → toggles `archived` flag. Archive redirects back to `/clients`.

**Meetings tab functions:**

`openAddMeeting()` → opens modal in "add" mode with blank form.

`openEditMeeting(meeting)` → opens modal in "edit" mode; converts Timestamp to `datetime-local` string via `toDatetimeLocal(ts)`.

`handleSaveMeeting()` → calls `addMeeting` or `updateMeeting` then re-fetches all meetings for the client.

`handleDeleteMeeting()` → `deleteMeeting(id)`, removes from local state.

`handleConfirmMeeting(meeting, completed)` → `updateMeeting(id, { completed })` — resolves past meetings as done/missed.

**`MeetingCard`** — displays a single meeting. Shows "Did this meeting happen?" confirmation UI for past meetings where `completed === null`.

**`Field`** — polymorphic form field: renders `<input>`, `<select>`, or `<textarea>` based on props.

**`ProgressRow`** — clickable milestone toggle row (black when checked, gray when not).

`toDatetimeLocal(ts)` → converts Firestore Timestamp or ISO string to `YYYY-MM-DDTHH:MM` for `datetime-local` inputs.

### `/follow-ups` — Follow-up Queue

`classifyClients(clients, followUpDays, inactivityDays)` → sorts clients into 4 buckets:
- **type3** (Scheduled): `scheduledFollowUpAt <= today`, sorted by date ascending
- **type2** (Inactivity): `daysSinceRef >= inactivityDays`, sorted by most days descending
- **type1** (First follow-up overdue): never contacted AND `daysSinceCreated >= followUpInterval`, sorted by most overdue
- **upcoming**: due within 7 days (either by interval or scheduled date)

`handleCheck(client)` → marks as contacted (`lastContactedAt: serverTimestamp()`, clears `scheduledFollowUpAt`), removes client from applicable bucket optimistically.

`handleArchive(client)` → archives client, removes from list, shows toast.

`Section` — labelled group with count badge.

`ClientRow` — shows client info + Archive button + circular "contacted" check button.

### `/calendar` — Meeting Calendar

**Calendar grid:** computed from `year`, `month` state. Calculates `offset` (Monday-first alignment) and total cells.

**Helper functions:**

`toLocalDateStr(ts)` → converts Timestamp to `"YYYY-MM-DD"` string for day-keyed lookup.

`toDatetimeLocal(ts)` → same as client detail page.

`formatTime(ts)` → formats to `HH:MM` (12h with AM/PM).

`prevMonth()` / `nextMonth()` → navigate months, rolling year at boundaries.

`openAdd(dateStr)` → opens modal pre-filled with `dateStr + T09:00`.

`openEdit(meeting, e)` → opens modal in edit mode; `e.stopPropagation()` prevents calendar cell click.

`handleSave()` → creates or updates meeting, re-fetches all meetings for user.

`handleDelete()` → deletes meeting, removes from local state.

Meetings are bucketed into `meetingsByDay` dict (keyed by date string) for dot indicators on calendar cells.

**Sections rendered below calendar:**
- "Needs Confirmation" — past meetings with `completed === null`, with Yes/No buttons
- "Upcoming Meetings" — next 10 meetings from today

### `/messaging` — Bulk Messaging

Wrapped in `<Suspense>` (for `useSearchParams`). Reads `?groupId=` from URL to pre-select a group.

**Helper functions:**

`extractVariables(body)` → regex `{{(\w+)}}` matches → unique variable names array.

`renderTemplate(body, vars)` → replaces `{{key}}` with `vars[key]`, or leaves placeholder if missing.

**Step 1 — Select Group:** dropdown of user's messaging groups. On selection, loads all client docs for that group in parallel.

**Step 2 — Select/Create Template:**

`handleSaveTemplate()` → extracts variables from body, calls `addMessageTemplate`, adds to local list.

`handleDeleteTemplate(t)` → confirms, calls `deleteMessageTemplate`, removes from list.

**Step 3 — Preview:** renders `renderTemplate` for each Telegram-eligible client in selected group. Only Telegram clients receive messages.

**`handleSend()`:**
1. POSTs to `http://localhost:8080/api/send` with `{ template, recipients: [{ name, telegram }] }`
2. Streams NDJSON response line by line, appending each parsed result to `sendResults`
3. On network error → falls back to `fallbackMode` (manual copy-paste per recipient)

**`handleCopy(idx, text)`** → copies message to clipboard, shows "Copied" feedback for 2s.

### `/groups` — Messaging Groups

Two views managed by `selectedGroup` state (null = list, object = drill-down).

**List view functions:**

`handleCreateGroup()` → calls `addMessagingGroup`, prepends to local state.

**Drill-down view functions:**

`openGroup(group)` → sets selected group, fetches all client docs for `group.clientIds` in parallel.

`handleDeleteGroup()` → confirms, calls `deleteMessagingGroup`, returns to list.

`handleRemoveClient(client)` → filters client ID out of `selectedGroup.clientIds`, calls `updateMessagingGroup`, updates local state.

`handleAddClient(client)` → deduplicates and appends client ID to `selectedGroup.clientIds`, calls `updateMessagingGroup`, appends to `groupClients`.

**Add clients modal:** searchable list of user's clients not already in the group (capped at 20 results).

### `/settings` — User Settings

**Functions:**

`handleSaveReminders()` → clamps values (followUpDays: 1–365, inactivityDays: 7–365), calls `updateUserProfile(uid, { followUpDays, inactivityCheckDays })`.

`handleAddMilestone()` → deduplicates, appends to `customMilestones` array, calls `updateUserProfile`.

`handleDeleteMilestone(name)` → filters name out, calls `updateUserProfile`.

Sign out: `signOut(auth)` then redirect to `/login`.

Admin-only: button to `/admin` visible only when `profile.role === "Admin"`.

### `/admin` — Admin Dashboard
Role-guard: redirects to `/` if not Admin.
Single card navigates to `/admin/users`.

### `/admin/users` — Admin User List
Role-guard: redirects to `/` if not Admin.

Fetches all users via `getAllUsers()`. Accordion-style expand per user to see name/email/role.

Header button navigates to `/admin/users/new` (page not present in current codebase — stub route).

---

## Components

### `PageShell`
Props: `{ title, rightAction?, children, backHref? }`

Renders: `SideNav` + fixed top header (with optional back button + right action) + scrollable content area + `BottomNav`. Sidebar-aware layout shift via `ml` class.

### `BottomNav`
Mobile-only (`md:hidden`). 5 tabs: Home, Clients, Add Client (FAB, raised), Groups, Settings. Active detection via `usePathname`.

### `SideNav`
Desktop-only (`hidden md:flex`). Collapsible (16px collapsed, 240px expanded). 7 nav items. Includes "Add Client" CTA button at top. Toggle button shows `FiChevronLeft`/`FiChevronRight`.

### `AdminBottomNav`
Mobile-only. 2 tabs: Users, Settings. Used only in admin pages.

### `AdminPageShell`
Thin wrapper that applies sidebar margin offset and appends `AdminBottomNav`. Used as a layout shell for admin pages that don't use `PageShell`.

### `ClientCard`
Props: `{ client, onRemove?, onSelect?, selected? }`

Three right-side modes:
- `onSelect` present → circular checkbox (select mode)
- `onRemove` present → × remove button
- Neither → chevron arrow (navigate mode)

Navigates to `/client/{id}` if no `onSelect` handler.

### `SearchBar`
Props: `{ value, onChange, placeholder? }`

Renders: search icon + text input + clear (×) button when value non-empty.

### `Spinner`
Props: `{ fullScreen? }`

Full-screen: centred on white background. Inline: centred with vertical padding.

---

## Auth Flow (End-to-End)

```
User visits any route
  → useRequireAuth fires
    → if loading: wait
    → if !user: redirect to /login

/login page:
  signInWithEmailAndPassword
    → getUserProfile(uid)
      → if no profile: error message
      → if role == "Admin": → /admin
      → else: → /

AuthContext runs globally:
  onAuthStateChanged fires on every page load
    → sets user + profile
    → needsSetup = true if auth user exists but no Firestore profile
```

---

## Follow-up Logic

```
For each client:
  1. Compute refDate:
       lastContactedAt → createdAt → null

  2. Compute scheduled:
       scheduledFollowUpAt (if set)

  3. Overdue check (used in Dashboard + Follow-ups page):
       - If scheduled <= today → OVERDUE (Scheduled type)
       - If daysSince(ref) >= inactivityDays → OVERDUE (Inactivity type)
       - If !lastContactedAt AND daysSinceCreated >= followUpInterval → OVERDUE (First follow-up type)

  4. followUpInterval:
       client.followUpDays ?? profile.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS (7)

  5. inactivityDays:
       profile.inactivityCheckDays ?? DEFAULT_INACTIVITY_DAYS (30)
```

---

## Messaging Flow

```
/groups → create group → add clients to group
/messaging:
  1. Select group → loads Telegram-eligible clients
  2. Select or create message template (supports {{variable}} syntax)
  3. Preview rendered messages per client
  4. Send:
     POST http://localhost:8080/api/send
       body: { template, recipients: [{ name, telegram }] }
       response: streaming NDJSON
         { name, status: "sent" | "failed" } per line
     On connection failure → fallback to manual copy-paste
```

---

## Meeting Lifecycle

```
Create meeting:
  addMeeting({ clientId, clientName, date, notes, nextActions, assignedTo })
    → date string → Firestore Timestamp
    → completed = date < now ? true : null

Past meeting with completed === null:
  → "Needs Confirmation" UI shown in Calendar + ClientDetail
  → User picks Yes (completed: true) or No (completed: false)

Meeting counting (Dashboard stats):
  meetingCount = meetings where completed === true AND date >= periodStart
```

---

## Role System

| Role | Access |
|---|---|
| `"User"` | Dashboard, Clients, Calendar, Follow-ups, Messaging, Groups, Settings |
| `"Admin"` | All user routes + `/admin`, `/admin/users` |

- Admin guard: `useEffect` redirects to `/` if `profile.role !== "Admin"`.
- Admin link in Settings only shown to Admins.
- `getAllUsers()` is called only from admin pages — no Firestore security rules are enforced client-side beyond UI gating (Firestore rules must be configured separately in Firebase console).

---

## Key Design Decisions

- **Optimistic UI**: "Mark as Contacted" and archive actions update local state immediately before Firestore confirmation.
- **Lazy loading**: Meetings tab data is only fetched when the user first opens the tab (`meetingsFetched` guard).
- **Archived clients**: Soft-deleted via `archived: true` flag. The Firestore query fetches all and filters client-side (no compound index needed).
- **Denormalised `clientName`**: Stored on meetings to avoid join-style fetches when listing meetings across clients.
- **Template variables**: Simple `{{key}}` regex substitution — no template engine dependency.
- **Streaming send results**: Uses `ReadableStream` + `TextDecoder` to process NDJSON line-by-line for real-time send status.
- **Sidebar state**: Persisted only in memory (React state), resets on page refresh.
