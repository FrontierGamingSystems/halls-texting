-- Dedicated, additive bingo schema. No existing application tables are changed.
create table if not exists public.bingo_halls (id text primary key, record jsonb not null);
create table if not exists public.bingo_messages (id text primary key, received_at timestamptz not null, day date not null, record jsonb not null);
create index if not exists bingo_messages_day_time on public.bingo_messages(day,received_at desc);
create table if not exists public.bingo_message_halls (
 message_id text references public.bingo_messages(id) on delete cascade,
 hall_id text references public.bingo_halls(id), primary key(message_id,hall_id)
);
create index if not exists bingo_message_halls_hall on public.bingo_message_halls(hall_id,message_id);
create table if not exists public.bingo_state (key text primary key,value text not null);
create table if not exists public.bingo_link_mappings (url text primary key, final_url text, hall_ids jsonb not null,evidence text not null,checked_at timestamptz not null);
alter table public.bingo_halls enable row level security;
alter table public.bingo_messages enable row level security;
alter table public.bingo_message_halls enable row level security;
alter table public.bingo_state enable row level security;
alter table public.bingo_link_mappings enable row level security;
revoke all on public.bingo_halls,public.bingo_messages,public.bingo_message_halls,public.bingo_state,public.bingo_link_mappings from anon,authenticated;
grant select on public.bingo_halls,public.bingo_messages,public.bingo_message_halls to anon,authenticated;
grant all on public.bingo_halls,public.bingo_messages,public.bingo_message_halls,public.bingo_state,public.bingo_link_mappings to service_role;
drop policy if exists bingo_halls_read on public.bingo_halls;
drop policy if exists bingo_messages_read on public.bingo_messages;
drop policy if exists bingo_message_halls_read on public.bingo_message_halls;
create policy bingo_halls_read on public.bingo_halls for select to anon,authenticated using(true);
create policy bingo_messages_read on public.bingo_messages for select to anon,authenticated using(record->>'kind' = 'promotion');
create policy bingo_message_halls_read on public.bingo_message_halls for select to anon,authenticated using(true);

create or replace function public.bingo_snapshot(requested_day date) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'halls',coalesce((select jsonb_agg(record order by record->>'name') from public.bingo_halls),'[]'::jsonb),
 'messages',coalesce((select jsonb_agg(record order by received_at desc,id desc) from public.bingo_messages where day=requested_day and record->>'kind'='promotion'),'[]'::jsonb),
 'summaries',coalesce((select jsonb_agg(jsonb_build_object('hallId',x.hall_id,'count',x.n,'latest',(
  select m.record from public.bingo_messages m join public.bingo_message_halls mh on mh.message_id=m.id where mh.hall_id=x.hall_id and m.record->>'kind'='promotion' order by m.received_at desc,m.id desc limit 1
 ))) from (select mh.hall_id,count(*) n from public.bingo_message_halls mh join public.bingo_messages m on m.id=mh.message_id where m.record->>'kind'='promotion' group by mh.hall_id) x),'[]'::jsonb),
 'unassignedCount',(select count(*) from public.bingo_messages m where m.record->>'kind'='promotion' and not exists(select 1 from public.bingo_message_halls mh where mh.message_id=m.id))
 );
$$;
create or replace function public.bingo_history(p_hall text,p_offset integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$
 with page as (select m.record,m.received_at,m.id from public.bingo_messages m join public.bingo_message_halls mh on mh.message_id=m.id where mh.hall_id=p_hall and m.record->>'kind'='promotion' order by m.received_at desc,m.id desc limit 101 offset greatest(0,p_offset))
 select jsonb_build_object('messages',coalesce((select jsonb_agg(record order by received_at desc,id desc) from (select * from page order by received_at desc,id desc limit 100) p),'[]'::jsonb),'hasMore',(select count(*)>100 from page));
$$;
-- Atomic ingestion is restricted to the server credential. Public users can only read.
create or replace function public.bingo_ingest(payload jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare h jsonb; m jsonb; k text; v jsonb; changed integer := 0;
begin
 for h in select * from jsonb_array_elements(coalesce(payload->'halls','[]'::jsonb)) loop
  insert into public.bingo_halls(id,record) values(h->>'id',h) on conflict(id) do update set record=excluded.record;
 end loop;
 for m in select * from jsonb_array_elements(coalesce(payload->'messages','[]'::jsonb)) loop
  if not exists(select 1 from public.bingo_messages where id=m->>'id') then changed:=changed+1; end if;
  insert into public.bingo_messages(id,received_at,day,record) values(m->>'id',(m->>'receivedAt')::timestamptz,(m->>'day')::date,m) on conflict(id) do update set record=excluded.record;
  delete from public.bingo_message_halls where message_id=m->>'id';
  insert into public.bingo_message_halls(message_id,hall_id) select m->>'id',value from jsonb_array_elements_text(coalesce(m->'hallIds','[]'::jsonb)) on conflict do nothing;
 end loop;
 for k,v in select * from jsonb_each(coalesce(payload->'state','{}'::jsonb)) loop
  insert into public.bingo_state(key,value) values(k,v#>>'{}') on conflict(key) do update set value=excluded.value;
 end loop;
 return changed;
end;
$$;
revoke all on function public.bingo_ingest(jsonb) from public,anon,authenticated;
grant execute on function public.bingo_ingest(jsonb) to service_role;
revoke all on function public.bingo_snapshot(date),public.bingo_history(text,integer) from public;
grant execute on function public.bingo_snapshot(date),public.bingo_history(text,integer) to anon,authenticated,service_role;

