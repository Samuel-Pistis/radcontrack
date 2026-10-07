begin;
alter table public.room_stock_movements add column version integer not null default 1;
alter table public.room_stock_movements add column voided_at timestamptz;
alter table public.room_stock_movements alter column created_at set default clock_timestamp();

create table radcontrack_private.stock_correction_audit (
 id uuid primary key default gen_random_uuid(), source text not null,
 record_id text not null, before_record jsonb not null, after_record jsonb not null,
 reason text not null, changed_by uuid not null references auth.users(id),
 changed_at timestamptz not null default clock_timestamp()
);
alter table radcontrack_private.stock_correction_audit enable row level security;
revoke all on radcontrack_private.stock_correction_audit from public,anon,authenticated;

create function radcontrack_private.correct_stock_movement(
 p_source text,p_id uuid,p_version integer,p_quantity numeric,p_date date,
 p_staff text,p_reference text,p_reason text,p_delete boolean
) returns integer language plpgsql security definer set search_path='' as $function$
declare
 v_item public.stock_items; v_store public.stock_movements; v_room public.room_stock;
 v_move public.room_stock_movements; v_delta numeric; v_role text;
 v_before jsonb; v_after jsonb; v_version integer;
begin
 perform radcontrack_private.assert_stock_user();
 v_role:=radcontrack_private.inventory_role();
 if p_source is null or p_source not in ('store','room') or p_delete is null or length(btrim(coalesce(p_reason,'')))<3 then
  raise exception 'Enter the reason for this correction';
 end if;
 -- All stock writers acquire the item lock before room or movement locks.
 select i.* into v_item from public.stock_items i where i.id=(
  select m.item_id from public.stock_movements m where p_source='store' and m.id=p_id
  union all select m.item_id from public.room_stock_movements m where p_source='room' and m.id=p_id
 ) for update;
 if not found then raise exception 'Stock entry not found'; end if;
 if not p_delete and (p_quantity is null or p_quantity<0 or p_quantity>1000000
  or p_quantity<>round(p_quantity,2) or (v_item.unit<>'ml' and p_quantity<>trunc(p_quantity))
  or p_date is null or p_date>(now() at time zone 'Africa/Lagos')::date
  or length(btrim(coalesce(p_staff,'')))<2) then
  raise exception 'Enter a valid date, staff name and quantity in the displayed unit';
 end if;
 if p_source='store' then
  select * into v_store from public.stock_movements where id=p_id for update;
  if v_store.voided_at is not null or p_version is distinct from v_store.version then
   raise exception 'This stock entry changed. Reload before correcting it';
  end if;
  if v_store.movement_type in ('receipt','opening') then
   perform radcontrack_private.assert_stock_manager();
  elsif v_store.movement_type='issue' then
   if v_role<>'stock_editor' and v_store.recorded_by<>auth.uid() then raise exception 'You may only correct your own daily picks'; end if;
  else raise exception 'This entry cannot be corrected here'; end if;
  v_before:=to_jsonb(v_store);
  if v_store.movement_type='opening' then
   if p_delete then raise exception 'Correct the count instead of deleting it. A count establishes the stock baseline'; end if;
   if p_date<>v_store.occurred_on then raise exception 'Keep the original count date. Record a new physical count for another date'; end if;
   if exists(select 1 from public.stock_movements where item_id=v_item.id and movement_type='opening' and created_at>v_store.created_at and voided_at is null) then
    raise exception 'A newer store count replaced this count. Correct the latest count or count stock now';
   end if;
   v_delta:=p_quantity-v_store.quantity;
  else
   if not p_delete and p_quantity=0 then raise exception 'Use Delete entry to remove a collection or pick'; end if;
   if (v_item.counted_at is not null and v_store.created_at<=v_item.counted_at)
    or v_store.occurred_on<v_item.counted_on or (not p_delete and p_date<v_item.counted_on) then
    raise exception 'A later store count includes this entry. Record a physical count now instead';
   end if;
   v_delta:=case when p_delete then -v_store.quantity else p_quantity-v_store.quantity end;
  end if;
  if v_store.movement_type='issue' then
   select * into v_room from public.room_stock where room=v_store.destination and item_id=v_item.id for update;
   if not found then raise exception 'The receiving room record is missing'; end if;
   select * into v_move from public.room_stock_movements where batch_id=v_store.batch_id and item_id=v_item.id
    and room=v_store.destination and movement_type='pick' for update;
   if not found then raise exception 'The linked room pick is missing. Record physical counts instead'; end if;
   if v_move.voided_at is not null or (v_room.counted_at is not null and v_move.created_at<=v_room.counted_at)
    or v_move.occurred_on<v_room.counted_on or (not p_delete and p_date<v_room.counted_on) then
    raise exception 'A later room count includes this pick. Record physical counts now instead';
   end if;
   if v_room.balance+v_delta<0 then raise exception 'This stock has already been used. Correct the usage first or count the remaining stock'; end if;
   if v_item.balance-v_delta<0 then raise exception 'Not enough stock remains in the store for this corrected pick'; end if;
   update public.room_stock set balance=balance+v_delta where room=v_room.room and item_id=v_item.id;
   update public.stock_items set balance=balance-v_delta where id=v_item.id;
   update public.room_stock_movements set change=case when p_delete then change else p_quantity end,
    occurred_on=case when p_delete then occurred_on else p_date end,
    staff_name=case when p_delete then staff_name else btrim(p_staff) end,
    version=version+1,voided_at=case when p_delete then clock_timestamp() end where id=v_move.id;
   insert into radcontrack_private.stock_correction_audit(source,record_id,before_record,after_record,reason,changed_by)
    select 'room',v_move.id::text,to_jsonb(v_move),to_jsonb(m),btrim(p_reason),auth.uid() from public.room_stock_movements m where id=v_move.id;
  else
   if v_item.balance+v_delta<0 then raise exception 'The correction would make store stock negative. Correct affected picks first or count stock now'; end if;
   update public.stock_items set balance=balance+v_delta where id=v_item.id;
  end if;
  update public.stock_movements set quantity=case when p_delete then quantity else p_quantity end,
   balance_after=case when movement_type='opening' then p_quantity else balance_after end,
   occurred_on=case when p_delete then occurred_on else p_date end,
   recipient_name=case when p_delete then recipient_name else btrim(p_staff) end,
   reference=case when p_delete then reference else nullif(btrim(p_reference),'') end,
   version=version+1,voided_at=case when p_delete then clock_timestamp() end where id=p_id
   returning to_jsonb(stock_movements),version into v_after,v_version;
 else
  select * into v_move from public.room_stock_movements where id=p_id for update;
  if v_move.movement_type<>'count' then raise exception 'Correct picks in Recent store movements and actual usage on the daily entry page'; end if;
  if v_move.voided_at is not null or p_version is distinct from v_move.version then raise exception 'This room count changed. Reload before correcting it'; end if;
  if v_role<>'stock_editor' and v_move.recorded_by<>auth.uid() then raise exception 'You may only correct your own room counts'; end if;
  if p_delete then raise exception 'Correct the count instead of deleting it. A count establishes the stock baseline'; end if;
  if p_date<>v_move.occurred_on then raise exception 'Keep the original count date. Record a new physical count for another date'; end if;
  select * into v_room from public.room_stock where room=v_move.room and item_id=v_item.id for update;
  if not found then raise exception 'Room stock not found'; end if;
  if exists(select 1 from public.room_stock_movements where room=v_move.room and item_id=v_item.id
   and movement_type='count' and created_at>v_move.created_at and voided_at is null) then
   raise exception 'A newer room count replaced this count. Correct the latest count or count stock now';
  end if;
  v_before:=to_jsonb(v_move); v_delta:=p_quantity-v_move.balance_after;
  if v_room.balance+v_delta<0 then raise exception 'The correction would make room stock negative. Correct the usage first or count stock now'; end if;
  update public.room_stock set balance=balance+v_delta where room=v_move.room and item_id=v_item.id;
  update public.room_stock_movements set change=change+v_delta,balance_after=p_quantity,staff_name=btrim(p_staff),version=version+1
   where id=p_id returning to_jsonb(room_stock_movements),version into v_after,v_version;
 end if;
 insert into radcontrack_private.stock_correction_audit(source,record_id,before_record,after_record,reason,changed_by)
  values(p_source,p_id::text,v_before,v_after,btrim(p_reason),auth.uid());
 return v_version;
end;
$function$;

create function public.correct_stock_movement(
 p_source text,p_id uuid,p_version integer,p_quantity numeric,p_date date,p_staff text,
 p_reference text,p_reason text,p_delete boolean default false
) returns integer language sql security invoker set search_path='' as $function$
 select radcontrack_private.correct_stock_movement(p_source,p_id,p_version,p_quantity,p_date,p_staff,p_reference,p_reason,p_delete);
$function$;
revoke all on function public.correct_stock_movement(text,uuid,integer,numeric,date,text,text,text,boolean),
 radcontrack_private.correct_stock_movement(text,uuid,integer,numeric,date,text,text,text,boolean) from public,anon;
grant execute on function public.correct_stock_movement(text,uuid,integer,numeric,date,text,text,text,boolean),
 radcontrack_private.correct_stock_movement(text,uuid,integer,numeric,date,text,text,text,boolean) to authenticated;

-- Keep the previous shift record, including patient counts and volume breakdowns.
create function radcontrack_private.audit_usage_correction() returns trigger
language plpgsql security definer set search_path='' as $function$
begin
 insert into radcontrack_private.stock_correction_audit(source,record_id,before_record,after_record,reason,changed_by)
 values('usage',concat_ws('/',old.date,old.room,old.shift,old.category),to_jsonb(old),to_jsonb(new),'Daily usage corrected',auth.uid());
 return new;
end;
$function$;
revoke all on function radcontrack_private.audit_usage_correction() from public,anon,authenticated;
create trigger audit_usage_correction after update on public.stock_shift_usage
 for each row execute function radcontrack_private.audit_usage_correction();
notify pgrst,'reload schema';
commit;
