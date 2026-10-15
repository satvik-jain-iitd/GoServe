-- Story S-B (#94). A tester's report from the Feedback button. Written only by the service role through n8n (GS SUB 17).
-- RLS is on and there is no policy: the phone can neither read nor write this table.

create table feedback (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid references kitchens (id),
  session_id text not null,
  role text not null check (role in ('customer', 'kitchen', 'rider', 'ops', 'console')),
  screen text not null,
  order_id uuid,
  doing text not null check (doing in ('ordering', 'cooking', 'delivering', 'watching ops', 'installing', 'other')),
  text text not null check (char_length(text) between 1 and 2000),
  context jsonb not null default '{}'::jsonb,
  drive_file_id text,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;
