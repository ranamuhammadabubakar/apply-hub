# Apply Hub
Student admission platform (FYP). Students apni profile bharte hain, institutions ki recommendations milti hain, aur wo apply + track kar sakte hain.

## Stack
- client: React (Vite) + TailwindCSS + react-router-dom
- server: Node.js (ES modules) + Express + MongoDB (Mongoose)
- Auth: JWT (Bearer token), bcryptjs
- Deploy: Vercel (client), Render (server), MongoDB Atlas (db)

## Roles
student, institute, admin

## Rules
- Har API response JSON ho. Errors: { message: "..." }
- Secrets sirf .env mein, kabhi commit na karein
- Chhote, simple files; har feature ke baad test karke dikhao
- Pehle MVP, phir extras. Scope se bahar features na banao