create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  last_message_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  message_type text not null default 'text' check (message_type in ('text', 'voice')),
  content text not null default '',
  audio_path text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now()
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  content text not null,
  confidence numeric(4, 3) not null default 1 check (confidence between 0 and 1),
  explicitly_stated boolean not null default true,
  source_message_id uuid references public.messages (id) on delete set null,
  last_confirmed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_user_last_message_idx
  on public.conversations (user_id, last_message_at desc);
create index conversations_expiry_idx on public.conversations (expires_at);
create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
create index messages_user_created_idx on public.messages (user_id, created_at desc);
create index messages_expiry_idx on public.messages (expires_at);
create index memories_user_confirmed_idx
  on public.memories (user_id, last_confirmed_at desc);
create index memories_expiry_idx on public.memories (expires_at);
create index profiles_last_seen_idx on public.profiles (last_seen_at);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function private.set_updated_at();

create trigger memories_set_updated_at
before update on public.memories
for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.memories enable row level security;

create policy profiles_owner_all
on public.profiles
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy conversations_owner_all
on public.conversations
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy messages_owner_all
on public.messages
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy memories_owner_all
on public.memories
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete
on public.profiles, public.conversations, public.messages, public.memories
to authenticated;
