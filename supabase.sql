create table tasks (
  id uuid primary key,
  title text not null,
  description text,
  status text not null default 'todo',
  created_at timestamptz default now()
);

alter table tasks enable row level security;

-- Simple college/demo setup.
-- This allows access without authentication.
-- For a real application, replace this with authenticated-user policies.

create policy "Allow public read"
on tasks for select
using (true);

create policy "Allow public insert"
on tasks for insert
with check (true);

create policy "Allow public update"
on tasks for update
using (true)
with check (true);

create policy "Allow public delete"
on tasks for delete
using (true);
