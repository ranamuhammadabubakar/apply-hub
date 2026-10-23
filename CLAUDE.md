# Apply Hub
Student admission platform (final year project). Students create a profile, get institution recommendations, and apply and track applications.

## Stack
- client: React (Vite) + TailwindCSS + react-router-dom
- server: Node.js (ES modules) + Express + MongoDB (Mongoose)
- Auth: JWT (Bearer token), bcryptjs
- Deploy: Vercel (client), Render (server), MongoDB Atlas (database)

## Roles
student, institute, admin

## Rules
- Every API response is JSON. Errors look like: { "message": "..." }
- Secrets only in .env files, never commit them
- All website text, UI labels, API messages, code comments and seed data must be in English only (no Roman Urdu)
- Keep files small and simple; test after each feature
- MVP first, extras later; do not build features outside the current scope