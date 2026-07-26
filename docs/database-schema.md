# Initial Database Schema

This is the simplified first-pass Supabase schema for Guide Cash Tracking.

## Core entities

### Tour guides
- Tour guides are Supabase Auth users.
- No separate `tour_guides` table is used yet.
- `auth.users.id` is referenced by application tables as the guide identity.

### Tours
- `tour_name`
- `start_date`
- `end_date`
- `tour_guide_id` -> `auth.users.id`
- `status`:
  - `not_started` = red
  - `in_progress` = yellow
  - `finished` = green

### Guide profiles
- `id` -> `auth.users.id`
- `email`
- `display_name`

### Expense reports
- `tour_id` -> `tours.id`
- `guide_id` -> `auth.users.id`
- `transaction_date`
- `transaction_memo`
- `currency`
- `amount`
- `status`:
  - `not_submitted` = red
  - `submitted` = yellow
  - `processed` = green

### Expense report lines
- `expense_report_id` -> `expense_reports.id`
- `line_date`
- `description`
- `category`
- `amount`

## Relationship summary

```mermaid
erDiagram
  auth_users ||--o{ tours : guides
  auth_users ||--o{ guide_profiles : profile
  tours ||--o{ expense_reports : contains
  auth_users ||--o{ expense_reports : submits
  expense_reports ||--o{ expense_report_lines : includes

  auth_users {
    uuid id PK
    text email
  }

  tours {
    uuid id PK
    text tour_name
    date start_date
    date end_date
    uuid tour_guide_id FK
    tour_status status
  }

  guide_profiles {
    uuid id PK
    text email
    text display_name
  }

  expense_reports {
    uuid id PK
    uuid tour_id FK
    uuid guide_id FK
    date transaction_date
    text transaction_memo
    char(3) currency
    numeric amount
    expense_report_status status
  }

  expense_report_lines {
    uuid id PK
    uuid expense_report_id FK
    date line_date
    text description
    text category
    numeric amount
  }
```

## Notes
- The schema is intentionally minimal.
- `tour_guides` can be added later if profile-specific data becomes necessary.
- `updated_at` is included for future editing flows.
- Owner-based RLS is enabled on `tours` and `expense_reports`.
- For the browser demo, `anon` can read seeded `tours`, `expense_reports`, and `expense_report_lines`.
- For the browser demo, `anon` can read `guide_profiles`.
- Each guide can still only add or edit rows where the ownership column matches their `auth.uid()`.
- Tours are public-read and add-only for the owning guide.
- Expense reports are public-read and add/update/delete only for the owning guide.
- Expense report lines are public-read and add/update/delete only for the owning guide through the parent report.
- Guide profiles are public-read only for demo rendering.
- Table access is limited to authenticated users.