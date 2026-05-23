# Student Portal — Design Spec

**Date:** 2026-05-23
**Status:** Approved

## Overview

A personal area for academy students accessible via web browser (PWA). Students log in with Email OTP, view their upcoming sessions and attendance history, and can send messages to the admin.

---

## 1. Authentication

**Method:** Supabase Email OTP (`signInWithOtp({ email, options: { shouldCreateUser: false } })`)
- Student enters email → Supabase sends a 6-digit code → student enters code on the same page
- A **separate login page** at `/student/login` handles the OTP flow exclusively for students
- The existing `/login` page (magic link) remains unchanged for coaches and admins
- `shouldCreateUser: false` ensures only pre-existing students in the DB can log in

**Role resolution** (`src/lib/auth/resolveRole.ts`):
Order of precedence:
1. Email in `ADMIN_EMAILS` env var → `admin`
2. Email in active coaches table → `coach`
3. Email in `students` table with `active: true` → `student`
4. Otherwise → `denied`

The function signature gains a new parameter: `activeStudentEmails: string[]`.

**Middleware** (`src/middleware.ts`):
- `/student/*` is guarded — only `student` role allowed
- Post-login redirect: `admin` → `/admin`, `coach` → `/coach`, `student` → `/student`

---

## 2. Pages & Routes

New route group: `src/app/(student)/`

| Path | Page | Description |
|------|------|-------------|
| `/student` | Dashboard | Upcoming sessions the student is enrolled in |
| `/student/history` | History | Past sessions where attendance status is `present` |
| `/student/contact` | Contact | Form to send a message to the admin |

**Layout** (`src/app/(student)/layout.tsx`):
- Simple navbar with 3 links: Dashboard / History / Contact
- Logout button
- Mobile-first, matches existing app styling

### Dashboard (`/student`)
- Lists future sessions where `session.student_ids.includes(studentId)`
- Sorted ascending by date
- Each row: date, time range, training type, address
- Empty state: "אין אימונים מתוכננים כרגע"

### History (`/student/history`)
- Fetches all attendance records for the student via `fetchAttendanceForStudent(studentId)`
- Filters to `status === 'present'`
- Joins with sessions data for display
- Sorted descending by date
- Each row: date, training type, coach name (derived from `coach_email`)
- Empty state: "אין היסטוריית אימונים עדיין"

### Contact (`/student/contact`)
- Form fields:
  - **Subject** (dropdown): `שאלה כללית` / `בעיה טכנית` / `אחר`
  - **Message** (textarea, required)
- On submit: inserts row into `contact_requests` table, shows success toast
- Student identity taken from session (no name field needed — we have it from DB)

---

## 3. Data Layer

### Existing tables (no schema changes)
- `sessions` — filter by `student_ids` array containing student's ID
- `attendance` — `fetchAttendanceForStudent(studentId)` already exists

### New: `contact_requests` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | auto-generated |
| `student_id` | text | FK → students.id |
| `subject` | text | selected category |
| `message` | text | free text |
| `created_at` | timestamptz | default now() |
| `status` | text | `new` \| `read` |

New module: `src/lib/sheets/contact.ts`
- `insertContactRequest(input)` — inserts a new request
- `fetchContactRequests()` — fetches all requests ordered by created_at desc
- `markContactRequestRead(id)` — sets status to `read`

### New data helpers
- `fetchSessionsForStudent(studentId)` — in `src/lib/sheets/sessions.ts`, filters `fetchSessionsAll()` by `student_ids`

---

## 4. Student Identity Resolution

After OTP login, the server must map the authenticated email → `student.id` to fetch personalized data. A helper `getStudentByEmail(email)` is added to `src/lib/sheets/students.ts`.

This is used in server components and API routes for the student portal — never expose `student_id` derivation to the client.

---

## 5. Admin Side

### Dashboard badge
- The existing admin dashboard shows a count of `contact_requests` with `status = 'new'`
- Clicking navigates to `/admin/messages`

### New page: `/admin/messages`
- Lists all contact requests, newest first
- Each row: student name, subject, date, message preview, status badge
- Clicking a `new` request marks it as `read` and shows full message

---

## 6. Out of Scope (Future)
- Push notifications (Web Push)
- Product/shop listing
- Link to academy website
- SMS OTP
- Student-to-student or student-to-coach messaging
- Admin replying to messages in-app
