# Simple Kanban Board

A simple HTML/CSS/JavaScript Kanban board focused on functionality.

## Features
- Add tasks
- Edit tasks
- Delete tasks
- Drag and drop between To Do, In Progress and Done
- Task counters
- LocalStorage persistence
- Optional Supabase connection
- Responsive layout

## Run locally
Double-click `index.html`.

An internet connection is needed for the Supabase JavaScript CDN. The basic board itself works without Supabase.

## Supabase setup
1. Create a Supabase project.
2. Open SQL Editor.
3. Run the SQL from `supabase.sql`.
4. Copy your project URL and anon/publishable key.
5. Open the board and click `Supabase`.
6. Enter the URL and key and click Connect.

The current demo policy is intentionally simple and allows public CRUD access. For a production project, use Supabase Auth and user-specific Row Level Security policies.
