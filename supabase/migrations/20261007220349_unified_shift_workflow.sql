-- Unified shift entry. Existing stock writers remain the only balance mutation path.
begin;
create table public.room_shift_reviews (
 date date not null, room text not null, shift text not null,
 details jsonb not null default '{}', physical jsonb not null default '{}',
 note text not null default '', staff text not null default '', stock_token text not null default '',
 finished boolean not null default false, version integer not null default 0,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(date,room,shift)
);
alter table public.room_shift_reviews enable row level security;
create policy approved_read on public.room_shift_reviews for select to authenticated
 using (radcontrack_private.inventory_role() is not null);
grant select on public.room_shift_reviews to authenticated;
revoke insert,update,delete on public.room_shift_reviews from anon,authenticated;

create function radcontrack_private.routine_item(p_id text,p_room text) returns boolean
language sql immutable set search_path='' as $$
 select case when p_id in ('a4_paper','gloves_piece') then false
 when p_id='mri_contrast' then p_room='MRI'
 when p_id in ('ct_contrast','gastrolux') then p_room in ('CT','Fluoroscopy') else true end
$$;
revoke all on function radcontrack_private.routine_item(text,text) from public,anon;
grant execute on function radcontrack_private.routine_item(text,text) to authenticated;

-- Reconstruct shift flows from effective movements, including corrections and counts.
-- An unassigned physical count is shown as an adjustment, never as a new receipt.
create function radcontrack_private.shift_context(p_date date,p_room text,p_shift text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_rank integer; v_token text;
begin
 perform radcontrack_private.assert_stock_user();
 v_rank:=array_position(array['morning','afternoon','night'],p_shift);
 if v_rank is null or p_room not in ('X-ray','CT','MRI','Fluoroscopy','Mammography') then raise exception 'Choose a room and shift';end if;
 select md5(coalesce(string_agg(id::text||':'||version::text||':'||change::text||':'||coalesce(voided_at::text,''),',' order by id),'')) into v_token
 from public.room_stock_movements where room=p_room;
 with movements as (
 select *,coalesce(array_position(array['morning','afternoon','night'],shift),1) as rank
 from public.room_stock_movements where room=p_room and voided_at is null
 ), flows as (
 select i.id,i.name,i.unit,
 coalesce(sum(m.change) filter(where m.occurred_on<p_date or (m.occurred_on=p_date and m.rank<v_rank)),0) as opening,
 coalesce(sum(m.change) filter(where m.occurred_on=p_date and m.rank=v_rank and m.movement_type='pick'),0) as received,
 coalesce(sum(m.change) filter(where m.occurred_on=p_date and m.rank=v_rank and m.movement_type='count'),0) as adjustment,
 coalesce(sum(m.change) filter(where m.occurred_on<p_date or (m.occurred_on=p_date and m.rank<=v_rank)),0) as remaining,
 (coalesce(bool_or(m.movement_type='count' and (m.occurred_on<p_date or (m.occurred_on=p_date and m.rank<=v_rank))),false)
 and not coalesce(bool_or(m.movement_type='count' and m.occurred_on=p_date and m.shift is null),false)) as known
 from public.stock_items i left join movements m on m.item_id=i.id
 where i.active and radcontrack_private.routine_item(i.id,p_room) group by i.id,i.name,i.unit
 ) select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(flows) order by name),'[]'),'token',v_token) into v_result from flows;
 return v_result;
end $$;
create function public.shift_context(p_date date,p_room text,p_shift text) returns jsonb
language sql security invoker set search_path='' as $$select radcontrack_private.shift_context(p_date,p_room,p_shift)$$;
revoke all on function radcontrack_private.shift_context(date,text,text),public.shift_context(date,text,text) from public,anon;
grant execute on function radcontrack_private.shift_context(date,text,text),public.shift_context(date,text,text) to authenticated;

create function radcontrack_private.save_shift(p_date date,p_room text,p_shift text,p_details jsonb,p_staff text,
 p_version integer,p_film_version integer,p_supply_version integer,p_finish boolean,p_physical jsonb,p_note text,p_token text) returns integer
language plpgsql security definer set search_path='' as $$
declare v_old public.room_shift_reviews; v_id text; v_d jsonb; v_qty numeric; v_pat integer;
 v_films jsonb; v_supplies jsonb; v_volumes jsonb:='{}'; v_film_pat integer:=0;
 v_context jsonb; v_item jsonb; v_actual numeric; v_expected numeric; v_previous numeric; v_res integer;
begin
 perform radcontrack_private.assert_stock_user();
 if p_date is null or p_date>(now() at time zone 'Africa/Lagos')::date or p_room is null or p_room not in ('X-ray','CT','MRI','Fluoroscopy','Mammography') or p_shift is null or p_shift not in ('morning','afternoon','night') or length(btrim(coalesce(p_staff,'')))<2 or jsonb_typeof(p_details) is distinct from 'object' or jsonb_typeof(p_physical) is distinct from 'object' or p_finish is null then raise exception 'Complete the date, room, shift and staff name';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('clinical/'||p_date::text,0));
 -- Do not silently count an earlier separate clinical record a second time.
 if exists(select 1 from public.daily_contrast_data d, jsonb_each(d.data) s, jsonb_each(case when jsonb_typeof(s.value)='object' then s.value else '{}' end) c
 where d.date=p_date and s.key=p_shift and c.key in ('jodascan300','hexopack350','gastrolux','mriContrast') and (coalesce((c.value#>>'{consumption,mls}')::numeric,0)>0 or coalesce((c.value#>>'{consumption,bottles}')::numeric,0)>0 or coalesce((c.value->>'patients')::numeric,0)>0))
 and ((p_finish and p_room in ('CT','MRI','Fluoroscopy')) or exists(select 1 from jsonb_each(p_details) x where x.key in ('ct_contrast','mri_contrast','gastrolux') and coalesce((x.value->>'used')::numeric,0)>0))
 then raise exception 'This shift has an earlier clinical contrast entry. Reconcile that entry before adding connected contrast usage; it has not been deducted again';end if;
 -- Same lock order as other inventory writers; protects finish checks from concurrent top-ups.
 perform 1 from public.stock_items order by id for update;
 insert into public.room_shift_reviews(date,room,shift) values(p_date,p_room,p_shift) on conflict do nothing;
 select * into v_old from public.room_shift_reviews where date=p_date and room=p_room and shift=p_shift for update;
 if v_old.version is distinct from p_version then raise exception 'This shift changed. Reload before saving';end if;
 v_context:=radcontrack_private.shift_context(p_date,p_room,p_shift);
 if p_finish and v_context->>'token' is distinct from p_token then raise exception 'Room stock changed. Reload and check what remains before finishing';end if;
 select quantities into v_films from public.stock_shift_usage where date=p_date and room=p_room and shift=p_shift and category='films';
 select quantities into v_supplies from public.stock_shift_usage where date=p_date and room=p_room and shift=p_shift and category='supplies';
 v_films:=coalesce(v_films,'{}');v_supplies:=coalesce(v_supplies,'{}');
 -- Preserve administrative/historical quantities outside the routine form.
 foreach v_id in array array['ct_contrast','mri_contrast','gastrolux'] loop
  if v_supplies ? v_id then v_volumes:=jsonb_set(v_volumes,array[v_id],'{"keep_existing":true}');end if;
 end loop;
 for v_id,v_d in select key,value from jsonb_each(p_details) loop
  if not exists(select 1 from public.stock_items where id=v_id and active and radcontrack_private.routine_item(id,p_room)) then raise exception 'Choose a routine item for this room';end if;
  if jsonb_typeof(v_d->'used') is distinct from 'number' or (v_d->>'used')!~'^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'Enter a valid amount used';end if;
  v_qty:=(v_d->>'used')::numeric;
  if v_id not in ('ct_contrast','mri_contrast','gastrolux') and coalesce((v_d->>'waste')::numeric,0)<>0 then raise exception 'Only contrast has a separate ml wastage field';end if;
  if v_id in ('ct_contrast','mri_contrast','gastrolux','film1714','film1210') then
   if jsonb_typeof(v_d->'patients') is distinct from 'number' or (v_d->>'patients')!~'^[0-9]+$' then raise exception 'Enter patients for each contrast or film size';end if;
   v_pat:=(v_d->>'patients')::integer;
   if v_pat>10000 or (v_qty>0 and v_pat=0) or (v_qty=0 and v_pat>0) then raise exception 'Check the patients and amount used';end if;
  end if;
  if v_id in ('film1714','film1210') then
   if v_pat>v_qty then raise exception 'Patients cannot exceed films printed';end if;
   v_films:=jsonb_set(v_films,array[v_id],to_jsonb(v_qty));v_film_pat:=v_film_pat+v_pat;
  else
   if v_id in ('ct_contrast','mri_contrast','gastrolux') then
    if jsonb_typeof(v_d->'waste') is distinct from 'number' or (v_d->>'waste')!~'^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'Enter wastage in ml, including zero when none';end if;
    v_volumes:=jsonb_set(v_volumes,array[v_id],jsonb_build_object('administered_ml',v_qty,'waste_ml',(v_d->>'waste')::numeric));
    v_qty:=v_qty+(v_d->>'waste')::numeric;
   end if;
   v_supplies:=jsonb_set(v_supplies,array[v_id],to_jsonb(v_qty));
  end if;
  select coalesce(sum((quantities->>v_id)::numeric),0) into v_previous from public.stock_shift_usage where date=p_date and room=p_room and shift=p_shift;
  select value into v_item from jsonb_array_elements(v_context->'items') where value->>'id'=v_id;
  if (v_item->>'remaining')::numeric+v_previous-v_qty<0 then raise exception 'Not enough stock recorded for this shift. Record its pickup or check the opening count';end if;
 end loop;
 if p_finish then
  for v_item in select value from jsonb_array_elements(v_context->'items') loop
   v_id:=v_item->>'id';
   if p_details->v_id->'reviewed' is distinct from 'true'::jsonb then raise exception 'Review every item or select None used';end if;
   if jsonb_typeof(p_physical->v_id) is distinct from 'number' or (p_physical->>v_id)!~'^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'Confirm what remains for every item';end if;
   v_actual:=(p_physical->>v_id)::numeric;
   if v_actual>1000000 or (v_id not in ('ct_contrast','mri_contrast','gastrolux') and v_actual<>trunc(v_actual)) then raise exception 'Check the remaining quantity';end if;
   select coalesce(sum((quantities->>v_id)::numeric),0) into v_previous from public.stock_shift_usage where date=p_date and room=p_room and shift=p_shift;
   v_expected:=(v_item->>'remaining')::numeric+v_previous-coalesce((p_details->v_id->>'used')::numeric,0)-coalesce((p_details->v_id->>'waste')::numeric,0);
   if (not (v_item->>'known')::boolean or v_actual<>v_expected) and length(btrim(coalesce(p_note,'')))<5 then raise exception 'Explain the difference or unconfirmed opening balance before finishing';end if;
  end loop;
 end if;
 v_res:=radcontrack_private.save_room_usage_volume(p_date,p_room,p_shift,'films',v_films,v_film_pat,p_staff,p_film_version,'{}');
 v_res:=radcontrack_private.save_room_usage_volume(p_date,p_room,p_shift,'supplies',v_supplies,0,p_staff,p_supply_version,v_volumes);
 update public.room_shift_reviews set details=p_details,physical=p_physical,note=coalesce(p_note,''),staff=btrim(p_staff),stock_token=radcontrack_private.shift_context(p_date,p_room,p_shift)->>'token',finished=p_finish,version=v_old.version+1,updated_at=clock_timestamp() where date=p_date and room=p_room and shift=p_shift;
 insert into radcontrack_private.stock_correction_audit(source,record_id,before_record,after_record,reason,changed_by)
 select 'usage',p_date::text||'/'||p_room||'/'||p_shift,to_jsonb(v_old),to_jsonb(r),case when p_finish then 'Shift reviewed and finished' else 'Shift progress saved' end,auth.uid() from public.room_shift_reviews r where date=p_date and room=p_room and shift=p_shift;
 return v_old.version+1;
end $$;
create function public.save_shift(p_date date,p_room text,p_shift text,p_details jsonb,p_staff text,p_version integer,p_film_version integer,p_supply_version integer,p_finish boolean,p_physical jsonb,p_note text,p_token text) returns integer
language sql security invoker set search_path='' as $$select radcontrack_private.save_shift(p_date,p_room,p_shift,p_details,p_staff,p_version,p_film_version,p_supply_version,p_finish,p_physical,p_note,p_token)$$;
revoke all on function radcontrack_private.save_shift(date,text,text,jsonb,text,integer,integer,integer,boolean,jsonb,text,text),public.save_shift(date,text,text,jsonb,text,integer,integer,integer,boolean,jsonb,text,text) from public,anon;
grant execute on function radcontrack_private.save_shift(date,text,text,jsonb,text,integer,integer,integer,boolean,jsonb,text,text),public.save_shift(date,text,text,jsonb,text,integer,integer,integer,boolean,jsonb,text,text) to authenticated;

-- Subsequent picks, corrections or usage invalidate affected handovers for re-review.
create function radcontrack_private.reopen_room_reviews() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.room_shift_reviews set finished=false,version=version+1 where room=new.room and date>=least(new.occurred_on,case when tg_op='UPDATE' then old.occurred_on else new.occurred_on end) and finished;
 return new;
end $$;
revoke all on function radcontrack_private.reopen_room_reviews() from public,anon,authenticated;
create trigger reopen_room_reviews after insert or update on public.room_stock_movements for each row execute function radcontrack_private.reopen_room_reviews();

create or replace function public.save_room_usage_units(p_date date,p_room text,p_shift text,p_category text,p_quantities jsonb,p_patients integer,p_staff text,p_version integer,p_volumes jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.room_shift_reviews where date=p_date and room=p_room and shift=p_shift) then raise exception 'Use the connected daily entry to correct this shift. Refresh the app';end if;
 return radcontrack_private.save_room_usage_volume(p_date,p_room,p_shift,p_category,p_quantities,p_patients,p_staff,p_version,p_volumes);
end $$;

create function radcontrack_private.prevent_duplicate_clinical() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('clinical/'||new.date::text,0));
 if exists(select 1 from public.room_shift_reviews r,jsonb_each(r.details) d where r.date=new.date and d.key in ('ct_contrast','mri_contrast','gastrolux') and coalesce((d.value->>'used')::numeric,0)>0) then
  raise exception 'This date uses connected shift entries. Edit contrast on the daily usage page';
 end if;
 return new;
end $$;
revoke all on function radcontrack_private.prevent_duplicate_clinical() from public,anon,authenticated;
create trigger prevent_duplicate_clinical before insert or update on public.daily_contrast_data for each row execute function radcontrack_private.prevent_duplicate_clinical();
commit;
