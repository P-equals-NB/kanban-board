# Kanban — Task Management

An upgraded version of the original simple HTML/CSS/JavaScript Kanban board.

## Features

- Landing page and Login / Sign up
- Supabase Auth with persistent sessions
- User-specific tasks protected by Supabase Row Level Security
- Local demo mode when Supabase is not configured
- Dashboard with total, in-progress, complete and overdue counts
- Upcoming-task list and category breakdown
- To Do / In Progress / Done Kanban board
- Drag and drop status changes
- Task title and description
- Priority: Low / Medium / High
- Due dates and overdue / due-soon indicators
- Colour selection
- Category / tag
- Search and filters
- Dark mode
- Profile menu and display-name settings
- Responsive mobile layout

## Supabase setup

1. Create a Supabase project.
2. In SQL Editor, run `supabase.sql`.
3. Copy `config.example.js` to `config.js`.
4. Put your Supabase project URL and publishable/anon key into `config.js`.
5. Open `index.html` through a local/static web server.

Supabase Auth keeps the session in the browser. The database RLS policies restrict every task query to the authenticated user's `user_id`.

## Local demo mode

If `config.js` is missing or has empty values, the app still works. Click **Continue in local demo mode**. Tasks are stored in this browser's localStorage and are not uploaded anywhere.

## Important

The Supabase publishable/anon key is designed to be used by browser clients. Do not put a Supabase service-role key into `config.js`.
