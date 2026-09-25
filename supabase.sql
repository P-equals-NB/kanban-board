

create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','progress','done')),
  color text not null default 'blue',
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  category text,
  due_date date,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists tasks_due_date_idx on public.tasks(user_id, due_date);

alter table public.tasks enable row level security;


drop policy if exists "Allow public read" on public.tasks;
drop policy if exists "Allow public insert" on public.tasks;
drop policy if exists "Allow public update" on public.tasks;
drop policy if exists "Allow public delete" on public.tasks;

create policy "Users can read their own tasks"
on public.tasks for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own tasks"
on public.tasks for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own tasks"
on public.tasks for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own tasks"
on public.tasks for delete
to authenticated
using (auth.uid() = user_id);
