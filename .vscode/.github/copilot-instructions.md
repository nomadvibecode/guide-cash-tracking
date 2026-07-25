# Agent Instructions

Use this file to give the AI dev agent stable, project-wide guidance. Keep it short, explicit, and aligned with the actual app structure.

## General Rules
- You are a capable full-stack developer. Use HTML, CSS, JavaScript, and Bootstrap CSS 5 to develop the web application.
- Use already existing components instead of starting from scratch (mainly the available ones from Bootstrap, CSS 5 and the framework's JS library)
- Keep it simple.Do not use TypeScript and UI frameworks like React and Vue.
- For development environment, use Node.js, npm, and Vite. Use the latest stable versions of these tools.
- Backend: Use Supabase as a backend (database, authentication and storage).
- Deployment: Netlify.

## App Context

- Project name: Guide Cash Tracking
- Purpose: track, organize, and report cash-related guidance or flows for the app domain.
- Primary goal: make changes that fit the current architecture instead of introducing a new one.
- If the app structure is not yet defined, ask for the minimum missing context before inventing layers or dependencies.

## Architecture Guidelines

- Use Node.js, npm and Vite to structure the app with modular components.
- Use multi-page navigation (instead of single page with popups) and keep each page in separate file.
- Use modular design: split your app into self-contained components (e.g. UI pages, services, utils) to improve project maintenance. When reasonable, use separate files for the UI, business logic, styles, and other app assets. Avoid big and complex monolith code.
- Prefer the existing framework, language, and folder conventions already used in the repository.
- Keep business rules in the smallest appropriate domain/service layer.
- Keep UI, API, persistence, and utility concerns separated.
- Reuse existing helpers, components, and services before creating new abstractions.
- When a change touches multiple layers, update the narrowest layer first and keep the data flow easy to trace.

## User Interface (UI)

- Place different app pages in separate files (for better maintenance).
- Implement responsive design for desktop and mobile browsers.
- Implement modern and user-friendly UI design, using Bootstrap components and custom styles.
- Use icons, effects and visual cues to enhance user experience and make the app more intuitive.

## Backend

- Use Supabase as a backend to keep all app data.
- Use Supabase DB for data tables.
- Use Supabase Auth for authentication (users, register, login, logout).
- Use Supabase Storage to upload photos and files at the server-side.
- Optionally, use Supabase Edge Functions for special server-side interactions.

## Authentication and Authorization

- Use Supabase Auth for authentication and authorization with JWT tokens.
- Implement users (register, login, logout) and roles (normal and admin users).
- Use Row-Level Security (RLS) policies to implement access control.
- If role-based access control (RBAC) is needed, use `user_roles` table + RLS to implement it.
- Implement admin panel (or similar concept for special users, different from regular).

## Database

- Use best practices to design the Supabase DB schema, including normalization, indexing, and relationships.
- When changing the DB schema, always use Supabase migrations.
- Sync the DB migrations history from Supabase to a local project folder.

## Storage

- Store app user files (like photos and documents) in Supabase Storage.
- The project should use file upload and download somewhere, e.g. profile pictures or product photos.

## Deployment

- The project should be deployed live on the Internet (e.g. in Netlify, Vercel or similar platform).
- Provide sample credentials (e.g. demo / demo123) to simplify testing the app.

## GitHub Repo

- Use a GitHub repo to hold the project assets.

## Documentation
- Generate a project documentation in the GitHub repository.
- Project description: describe briefly the project (what it does, who can do what, etc.).
- Architecture: front-end, back-end, technologies used, database, etc.
- Database schema design: visualize the main DB tables and their relationships.
- Local development setup guide.
- Key folders and files and their purpose

## Code Standards

- Match the repository's existing style, naming, and formatting.
- Prefer small, focused changes over broad refactors.
- Avoid adding dependencies unless they clearly reduce complexity or are required.
- Do not introduce speculative abstractions, feature flags, or “future-proofing” unless the user asks for them.
- Keep comments minimal; only document non-obvious intent.

## AI Agent Workflow

- Start from the nearest relevant file, symbol, or failing behavior.
- Before editing, inspect just enough surrounding code to form one local hypothesis.
- After the first substantive edit, run the cheapest useful validation for the touched area.
- If a fix fails, repair the same slice first before widening the search.
- Preserve unrelated user changes and do not revert work you did not make.

## Project-Wide Rules

- Treat configuration files as source of truth for project behavior.
- Keep generated or temporary output out of version control.
- Prefer explicit, readable control flow over cleverness.
- If a request is ambiguous, choose the smallest safe implementation and state any assumptions clearly.

## Replace These Placeholders

- Add the real framework and runtime here.
- Add the main app folders here.
- Add domain-specific conventions here.
- Add any team rules about testing, review, or deployment here.
