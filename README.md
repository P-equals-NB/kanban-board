# Kanban Board 

A simple static Kanban board 

## Features

- Dashboard
- To Do / In Progress / Done columns
- Add, edit and delete tasks
- Drag-and-drop status changes
- Task descriptions
- Priority: low / medium / high
- Due dates
- Overdue and due-soon detection
- Categories
- Task colours
- Search
- Priority/category/due-date filters
- Task counters
- Upcoming tasks
- Category summary
- Light/dark theme
- LocalStorage mode
- Optional Supabase mode

## Files

- `index.html` — UI
- `style.css` — styling
- `script.js` — application logic
- `supabase.sql` — database/functions for passwordless Supabase boards

## Local mode

Open `index.html`.

Tasks are stored in the browser's LocalStorage.

## Supabase mode

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase.sql`.
4. Open the app.
5. Go to Settings -> Supabase.
6. Enter the project URL and publishable/anon key.
7. Click "Create new board".
8. The app generates a Board ID and Board access key.
9. Keep those two values if you want to reconnect to the same board elsewhere.

No Supabase Auth is used.

The Board ID + Board access key act as the board's shared credential. Anyone with both can read and modify that board.
