revoke all on function public.rls_auto_enable()
from public, anon, authenticated;

create index memories_source_message_idx
  on public.memories (source_message_id);
