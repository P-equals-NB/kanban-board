-- Kanban Board - passwordless Supabase storage
--
-- No Supabase Auth is required.
-- Each board is identified by a UUID + access key.
-- The browser calls SECURITY DEFINER RPC functions rather than
-- reading the tasks table directly.
--
-- IMPORTANT:
-- The access key is effectively the board's shared password.
-- Anyone who has the Board ID + access key can edit that board.
-- Keep those values private if the board should remain private.

create extension if not exists pgcrypto;

create table if not exists public.kanban_boards (
  id uuid primary key,
  access_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.kanban_tasks (
  id uuid primary key,
  board_id uuid not null references public.kanban_boards(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo'
    check (status in ('todo', 'progress', 'done')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  due_date date,
  category text,
  color text not null default 'blue'
    check (color in ('blue', 'purple', 'green', 'orange', 'red')),
  created_at timestamptz not null default now()
);

create index if not exists kanban_tasks_board_id_idx
  on public.kanban_tasks(board_id);

create index if not exists kanban_tasks_due_date_idx
  on public.kanban_tasks(board_id, due_date);

alter table public.kanban_boards enable row level security;
alter table public.kanban_tasks enable row level security;

-- No direct table access from the browser.
revoke all on public.kanban_boards from anon, authenticated;
revoke all on public.kanban_tasks from anon, authenticated;

create or replace function public.kanban_create_board(
  p_board_id uuid,
  p_access_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_board_id is null or length(trim(coalesce(p_access_key, ''))) < 16 then
    raise exception 'Invalid board ID or access key';
  end if;

  insert into public.kanban_boards (id, access_key)
  values (p_board_id, p_access_key);

  return jsonb_build_object(
    'id', p_board_id,
    'created', true
  );
end;
$$;

create or replace function public.kanban_get_tasks(
  p_board_id uuid,
  p_access_key text
)
returns setof public.kanban_tasks
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.kanban_boards
    where id = p_board_id
      and access_key = p_access_key
  ) then
    raise exception 'Invalid board ID or access key';
  end if;

  return query
  select *
  from public.kanban_tasks
  where board_id = p_board_id
  order by created_at asc;
end;
$$;

create or replace function public.kanban_upsert_task(
  p_board_id uuid,
  p_access_key text,
  p_task jsonb
)
returns public.kanban_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.kanban_tasks;
begin
  if not exists (
    select 1
    from public.kanban_boards
    where id = p_board_id
      and access_key = p_access_key
  ) then
    raise exception 'Invalid board ID or access key';
  end if;

  insert into public.kanban_tasks (
    id,
    board_id,
    title,
    description,
    status,
    priority,
    due_date,
    category,
    color,
    created_at
  )
  values (
    (p_task->>'id')::uuid,
    p_board_id,
    p_task->>'title',
    nullif(p_task->>'description', ''),
    coalesce(p_task->>'status', 'todo'),
    coalesce(p_task->>'priority', 'medium'),
    nullif(p_task->>'due_date', '')::date,
    nullif(p_task->>'category', ''),
    coalesce(p_task->>'color', 'blue'),
    coalesce((p_task->>'created_at')::timestamptz, now())
  )
  on conflict (id) do update set
    board_id = excluded.board_id,
    title = excluded.title,
    description = excluded.description,
    status = excluded.status,
    priority = excluded.priority,
    due_date = excluded.due_date,
    category = excluded.category,
    color = excluded.color,
    created_at = excluded.created_at
  where public.kanban_tasks.board_id = p_board_id
  returning * into result;

  if result.id is null then
    raise exception 'Task does not belong to this board';
  end if;

  return result;
end;
$$;

create or replace function public.kanban_delete_task(
  p_board_id uuid,
  p_access_key text,
  p_task_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.kanban_boards
    where id = p_board_id
      and access_key = p_access_key
  ) then
    raise exception 'Invalid board ID or access key';
  end if;

  delete from public.kanban_tasks
  where id = p_task_id
    and board_id = p_board_id;

  return found;
end;
$$;

revoke all on function public.kanban_create_board(uuid, text) from public;
revoke all on function public.kanban_get_tasks(uuid, text) from public;
revoke all on function public.kanban_upsert_task(uuid, text, jsonb) from public;
revoke all on function public.kanban_delete_task(uuid, text, uuid) from public;

grant execute on function public.kanban_create_board(uuid, text) to anon, authenticated;
grant execute on function public.kanban_get_tasks(uuid, text) to anon, authenticated;
grant execute on function public.kanban_upsert_task(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.kanban_delete_task(uuid, text, uuid) to anon, authenticated;

-- Optional cleanup:
-- If you ever want to remove an old board manually:
-- delete from public.kanban_boards where id = 'YOUR-BOARD-ID-HERE';
