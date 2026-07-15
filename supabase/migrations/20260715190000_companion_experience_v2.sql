alter table public.profiles
  add column if not exists current_mood text,
  add column if not exists emotional_need text,
  add column if not exists mood_updated_at timestamptz;

alter table public.messages
  add column if not exists companion_state text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_current_mood_check'
  ) then
    alter table public.profiles
      add constraint profiles_current_mood_check
      check (
        current_mood is null
        or current_mood in ('轻松', '开心', '疲惫', '委屈', '心烦', '心动')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_emotional_need_check'
  ) then
    alter table public.profiles
      add constraint profiles_emotional_need_check
      check (
        emotional_need is null
        or emotional_need in ('听我说', '哄哄我', '逗我开心', '陪我吐槽', '暧昧一点')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_companion_state_check'
  ) then
    alter table public.messages
      add constraint messages_companion_state_check
      check (
        companion_state is null
        or companion_state in (
          'approaching', 'attentive', 'teasing', 'soft',
          'proud', 'jealous', 'thinking', 'calm'
        )
      );
  end if;
end;
$$;

create index if not exists profiles_mood_updated_idx
  on public.profiles (mood_updated_at desc);
