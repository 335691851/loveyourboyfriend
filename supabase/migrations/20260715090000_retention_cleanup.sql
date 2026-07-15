create extension if not exists pg_cron with schema pg_catalog;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'voice-messages',
  'voice-messages',
  false,
  10000000,
  array[
    'audio/aac',
    'audio/m4a',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/webm'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy voice_objects_owner_select
on storage.objects for select to authenticated
using (
  bucket_id = 'voice-messages'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy voice_objects_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'voice-messages'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy voice_objects_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'voice-messages'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function private.refresh_conversation_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_at = now(),
      expires_at = now() + interval '90 days'
  where id = new.conversation_id
    and user_id = new.user_id;
  new.expires_at := now() + interval '90 days';
  return new;
end;
$$;

revoke all on function private.refresh_conversation_activity()
from public, anon, authenticated;

create trigger messages_refresh_conversation_activity
before insert on public.messages
for each row execute function private.refresh_conversation_activity();

create or replace function private.delete_expired_chat_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.messages where expires_at < now();
  delete from public.memories where expires_at < now();
  delete from public.conversations where expires_at < now();
  delete from public.profiles
  where last_seen_at < now() - interval '90 days'
    and not exists (
      select 1 from public.conversations
      where conversations.user_id = profiles.user_id
    );
end;
$$;

revoke all on function private.delete_expired_chat_data()
from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'delete-expired-love-your-boyfriend-data';

select cron.schedule(
  'delete-expired-love-your-boyfriend-data',
  '17 3 * * *',
  $$select private.delete_expired_chat_data();$$
);
