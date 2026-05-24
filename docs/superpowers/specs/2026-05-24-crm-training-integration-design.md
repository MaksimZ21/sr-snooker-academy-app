# CRM Training Integration — Design Spec

**Date:** 2026-05-24  
**Status:** Approved

## Overview

The CRM now sends training events via webhook. This spec covers:
1. Parsing and storing CRM training events as sessions
2. Matching attendance approvals from CRM to students
3. Admin UI for coach assignment
4. Coach + admin UI for marking attendance
5. Student history showing attendance per session

---

## CRM Payloads

**event_created** — new training scheduled:
```json
{
  "event_type": "event_created",
  "event_id": "304",
  "appointment_id": "678892",
  "meeting_time": "27/05/2026 17:00",
  "meeting_type": "מכללה תל אביב",
  "account_id": "3276279",
  "account_guid": "255f12aa-..."
}
```

**appointment_approved** — student confirmed attendance:
```json
{
  "event_type": "appointment_approved",
  "event_id": "304",
  "appointment_id": "678892",
  "meeting_time": "27/05/2026 17:00",
  "meeting_type": "מכללה תל אביב",
  "first_name": "מקסים זייץ",
  "last_name": "",
  "phone": "0556611088",
  "email": ""
}
```

---

## DB Changes

### sessions table
- Add column: `crm_appointment_id` (text, nullable) — unique identifier per appointment
- `end_time` — becomes optional (empty string allowed, Zod schema updated)

### attendance table
- Add `"confirmed"` to status enum: `"present" | "absent" | "late" | "confirmed"`
- `"confirmed"` = CRM approval (will come), `"present"` = coach marked as actually attended

---

## Webhook: POST /api/webhooks/crm/training

Single endpoint handles both event types via `event_type` field.

### event_created flow:
1. Parse `meeting_time` from "DD/MM/YYYY HH:MM" → `date: "YYYY-MM-DD"`, `start_time: "HH:MM"`
2. `end_time: ""` (filled manually by admin later)
3. Call `upsertSessionFromCrm` with `crm_appointment_id = appointment_id`
4. Look up group by `meeting_type` (case-insensitive exact match on `groups.name`)
5. If group found → set session's `student_ids` from group's `student_ids`
6. If group not found → session created with empty `student_ids`, no error

### appointment_approved flow:
1. Find session by `crm_appointment_id = appointment_id`
2. Find student by `phone` (primary) → fallback: `first_name + last_name` (trimmed, case-insensitive)
3. If session not found → 404
4. If student not found → log warning, return 200 (don't block CRM)
5. Upsert attendance record: `status: "confirmed"`, `marked_by: "crm"`, `marked_at: now()`

---

## Session Detail — Admin (/admin/sessions/[id])

### Coach assignment (admin only)
- Dropdown listing all active coaches
- On change: PATCH `/api/sessions/[id]` → update `coach_email`
- Saves immediately (no save button)

### Participants panel
Two sections side by side:
- **אמור להגיע** — all `student_ids` on the session (from group)
- **אישר הגעה** — attendance records with `status: "confirmed"` (from CRM)

### Attendance marking (admin + coach)
- Full list of session students
- Per student: buttons for ✓ הגיע / ✗ לא הגיע
- Students who confirmed via CRM show pre-filled `"confirmed"` badge
- Coach/admin can update to `"present"` / `"absent"` — updates attendance record immediately
- API: PATCH `/api/sessions/[id]/attendance` (already exists, verify it handles upsert)

---

## Session Detail — Coach (/coach/sessions/[id])

- Shows session info (date, time, type, group)
- Shows coach name (read-only, no dropdown)
- Attendance marking: same UI as admin — coach can mark present/absent
- Does NOT show coach assignment dropdown

---

## Student History

In student profile view (admin), the session list shows:
- Session date, time, type
- Attendance status for that student: `"confirmed"` / `"present"` / `"absent"` / `"late"` / `"—"` (no record)

---

## Schedule Visibility

CRM-created sessions (potentially without a coach) appear in:
- `/admin/schedule` — weekly grid (no coach filter = show all, including unassigned)
- `/admin/coaches/sessions` — after coach is assigned
- `/coach/sessions` — once `coach_email` is set on the session

No new schedule page needed.

---

## Files Touched

| File | Change |
|---|---|
| `src/lib/sheets/schemas.ts` | `end_time` optional, add `crm_appointment_id`, add `"confirmed"` to attendance status |
| `src/lib/sheets/sessions.ts` | `upsertSessionFromCrm` stores `crm_appointment_id`, accepts empty `end_time`, assigns group students |
| `src/app/api/webhooks/crm/training/route.ts` | Parse `meeting_time`, dispatch by `event_type`, handle `appointment_approved` |
| `src/app/api/webhooks/crm/attendance/route.ts` | Remove (logic moved into training route) or keep for backward compat |
| `src/app/api/sessions/[id]/route.ts` | Add PATCH handler for `coach_email` update |
| `src/components/session-detail.tsx` | Add coach assignment dropdown (admin), participants panel, attendance marking |
| `src/app/(coach)/coach/sessions/[id]/page.tsx` | Enable `canEditAttendance={true}` |
| Supabase migration | `crm_appointment_id` column, attendance status enum update |
