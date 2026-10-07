-- One-time base-unit conversion. Existing CT/MRI room records are already ml.
begin;
alter table public.stock_items alter column balance type numeric(18,2);
alter table public.stock_items add column counted_at timestamptz;
update public.stock_items set counted_at=(select max(created_at) from public.stock_movements m where m.item_id=stock_items.id and movement_type='opening') where opening_recorded;
alter table public.stock_movements alter column quantity type numeric(18,2);
alter table public.stock_movements alter column balance_after type numeric(18,2);
alter table public.stock_movements alter column created_at set default clock_timestamp();
alter table public.stock_movements add column version integer not null default 1;
alter table public.stock_movements add column voided_at timestamptz;
update public.stock_items set balance=balance*case id when 'ct_contrast' then 100 when 'mri_contrast' then 15 when 'gastrolux' then 100 else 100 end where id in ('ct_contrast','mri_contrast','gastrolux','film1714','film1210');
update public.stock_movements set quantity=quantity*case item_id when 'mri_contrast' then 15 else 100 end,balance_after=balance_after*case item_id when 'mri_contrast' then 15 else 100 end where item_id in ('ct_contrast','mri_contrast','gastrolux','film1714','film1210');
update public.room_stock set balance=balance*100 where item_id='gastrolux';
update public.room_stock_movements set change=change*100,balance_after=balance_after*100 where item_id='gastrolux';
update public.stock_shift_usage set quantities=jsonb_set(quantities,'{gastrolux}',to_jsonb((quantities->>'gastrolux')::numeric*100)),version=version+1 where quantities ? 'gastrolux';
update public.stock_items set unit='ml' where id in ('ct_contrast','mri_contrast','gastrolux');
update public.stock_items set unit='films' where id in ('film1714','film1210');
update public.stock_items set active=false where id='gloves_piece';

-- Roles are bound to immutable Auth user IDs, never editable user metadata.
create table radcontrack_private.inventory_members (
 user_id uuid primary key references auth.users(id),
 role text not null check(role in ('manager','staff')),
 active boolean not null default true
);
alter table radcontrack_private.inventory_members enable row level security;
revoke all on radcontrack_private.inventory_members from public,anon,authenticated;
insert into radcontrack_private.inventory_members(user_id,role)
 select id,'manager' from auth.users where lower(email)='btradiographers@gmail.com';
do $$begin if not exists(select 1 from radcontrack_private.inventory_members where role='manager') then raise exception 'Administrator login not found; migration cancelled';end if;end $$;
create function radcontrack_private.inventory_role() returns text language sql stable security definer set search_path='' as $$
 select role from radcontrack_private.inventory_members where user_id=auth.uid() and active and coalesce(auth.jwt()->>'is_anonymous','false')<>'true'
$$;
revoke all on function radcontrack_private.inventory_role() from public,anon;
grant execute on function radcontrack_private.inventory_role() to authenticated;
create or replace function radcontrack_private.assert_stock_user() returns void language plpgsql security invoker set search_path='' as $$
begin if radcontrack_private.inventory_role() is null then raise exception 'Your account has not been approved for radiology';end if;end $$;
create function radcontrack_private.assert_stock_manager() returns void language plpgsql security invoker set search_path='' as $$
begin if radcontrack_private.inventory_role() is distinct from 'manager' then raise exception 'Only the stock administrator can manage received stock';end if;end $$;
revoke all on function radcontrack_private.assert_stock_manager() from public,anon;
grant execute on function radcontrack_private.assert_stock_manager() to authenticated;
create function public.inventory_permissions() returns jsonb language sql security invoker set search_path='' as $$
select jsonb_build_object('has_access',radcontrack_private.inventory_role() is not null,'can_manage_stock',radcontrack_private.inventory_role()='manager')$$;
revoke all on function public.inventory_permissions() from public,anon;
grant execute on function public.inventory_permissions() to authenticated;

-- Replace old single-email policies with approved membership, retaining read-only ledgers.
do $$declare t text; p record;begin
 foreach t in array array['stock_items','stock_movements','room_stock','stock_shift_usage','room_stock_movements','daily_contrast_data','contrast_usage_logs'] loop
  if to_regclass('public.'||t) is not null then
   for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t);end loop;
   execute format('create policy approved_read on public.%I for select to authenticated using ((select radcontrack_private.inventory_role()) is not null)',t);
   if t in ('daily_contrast_data','contrast_usage_logs') then
    execute format('create policy approved_insert on public.%I for insert to authenticated with check ((select radcontrack_private.inventory_role()) is not null)',t);
    execute format('create policy approved_update on public.%I for update to authenticated using ((select radcontrack_private.inventory_role()) is not null) with check ((select radcontrack_private.inventory_role()) is not null)',t);
    if t='contrast_usage_logs' then execute format('create policy approved_delete on public.%I for delete to authenticated using ((select radcontrack_private.inventory_role()) is not null)',t);end if;
   end if;
  end if;
 end loop;
end $$;

create table radcontrack_private.stock_receipt_audit (
 id uuid primary key default gen_random_uuid(), receipt_id uuid not null references public.stock_movements(id),
 before_record jsonb not null, after_record jsonb not null, changed_by uuid not null references auth.users(id), changed_at timestamptz not null default now()
);
alter table radcontrack_private.stock_receipt_audit enable row level security;
revoke all on radcontrack_private.stock_receipt_audit from public,anon,authenticated;

create or replace function radcontrack_private.move_room_stock(p_type text,p_date date,p_staff text,p_lines jsonb,p_room text,p_shift text,p_reference text,p_request uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_batch uuid:=coalesce(p_request,gen_random_uuid()); v_line jsonb; v_item public.stock_items; v_room public.room_stock; v_qty numeric; v_factor integer; v_after numeric; v_payload jsonb; v_existing jsonb;
begin
 perform radcontrack_private.assert_stock_user();
 if p_type in ('receipt','opening') then perform radcontrack_private.assert_stock_manager(); end if;
 v_payload:=jsonb_build_object('type',p_type,'date',p_date,'staff',p_staff,'lines',p_lines,'room',p_room,'shift',p_shift,'reference',p_reference);
 insert into radcontrack_private.stock_batch_requests(id,payload,recorded_by) values(v_batch,v_payload,auth.uid()) on conflict do nothing;
 if not found then
  select payload into v_existing from radcontrack_private.stock_batch_requests where id=v_batch and recorded_by=auth.uid();
  if v_existing is distinct from v_payload then raise exception 'This entry changed after an uncertain save. Reload the register and review the earlier entry'; end if;
  return v_batch;
 end if;
 if p_type not in ('receipt','issue','opening','room_count') or p_type is null or p_date is null or p_date>(now() at time zone 'Africa/Lagos')::date or length(btrim(coalesce(p_staff,'')))<2 or jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Complete the date, staff name and items'; end if;
 if jsonb_array_length(p_lines) not between 1 and 50 then raise exception 'Choose at least one item'; end if;
 if p_type in ('issue','room_count') and (p_room is null or p_room not in ('X-ray','CT','MRI','Fluoroscopy')) then raise exception 'Choose the room receiving the stock'; end if;
 if p_type='issue' and (p_shift is null or p_shift not in ('morning','afternoon','night')) then raise exception 'Choose the shift receiving the stock'; end if;
 if p_type in ('opening','room_count') and p_date<>(now() at time zone 'Africa/Lagos')::date then raise exception 'Use today for a physical count of what is here now'; end if;
 if (select count(distinct value->>'item_id') from jsonb_array_elements(p_lines))<>jsonb_array_length(p_lines) then raise exception 'List each item only once'; end if;
 for v_line in select value from jsonb_array_elements(p_lines) order by value->>'item_id' loop
  if jsonb_typeof(v_line->'quantity') is distinct from 'number' or (v_line->>'quantity') !~ '^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'Enter whole quantities'; end if;
  v_qty:=(v_line->>'quantity')::numeric;
  if v_qty<0 or v_qty>1000000 or (v_qty=0 and p_type in ('receipt','issue')) then raise exception 'Only physical counts may be zero'; end if;
  select * into v_item from public.stock_items where id=v_line->>'item_id' and active for update;
  if not found then raise exception 'Choose a valid stock item'; end if;
  if v_qty<>trunc(v_qty) and v_item.id not in ('ct_contrast','mri_contrast','gastrolux') then raise exception 'Only contrast quantities accept decimal millilitres'; end if;
  v_factor:=1;
  if p_type<>'room_count' then
   if p_type<>'opening' and p_date<v_item.counted_on then raise exception 'This movement predates the latest store count. Do not add stock already included in that count'; end if;
   if p_type='issue' and v_item.balance<v_qty then raise exception 'Not enough recorded % in the store. Record a physical count or missing collection first',v_item.name; end if;
   v_after:=case p_type when 'opening' then v_qty when 'issue' then v_item.balance-v_qty else v_item.balance+v_qty end;
   insert into public.stock_movements(batch_id,item_id,movement_type,quantity,balance_after,balance_known,occurred_on,recipient_name,destination,shift,reference,recorded_by)
    values(v_batch,v_item.id,p_type,v_qty,v_after,v_item.opening_recorded or p_type='opening',p_date,btrim(p_staff),case when p_type='issue' then p_room end,p_shift,p_reference,auth.uid());
   update public.stock_items set balance=v_after,opening_recorded=opening_recorded or p_type='opening',counted_on=case when p_type='opening' then p_date else counted_on end,counted_at=case when p_type='opening' then clock_timestamp() else counted_at end where id=v_item.id;
  end if;
  if p_type in ('issue','room_count') then
   insert into public.room_stock(room,item_id) values(p_room,v_item.id) on conflict do nothing;
   select * into v_room from public.room_stock where room=p_room and item_id=v_item.id for update;
   if p_type='issue' and p_date<v_room.counted_on then raise exception 'This pick predates the room count and may already be included in it'; end if;
   -- Store, rooms and usage now share the same base units.
   v_after:=case when p_type='room_count' then v_qty else v_room.balance+v_qty*v_factor end;
   insert into public.room_stock_movements(batch_id,room,item_id,movement_type,change,balance_after,balance_known,occurred_on,shift,staff_name,recorded_by)
    values(v_batch,p_room,v_item.id,case when p_type='issue' then 'pick' else 'count' end,v_after-v_room.balance,v_after,v_room.counted_on is not null or p_type='room_count',p_date,p_shift,btrim(p_staff),auth.uid());
   update public.room_stock set balance=v_after,counted_on=case when p_type='room_count' then p_date else counted_on end,counted_at=case when p_type='room_count' then clock_timestamp() else counted_at end where room=p_room and item_id=v_item.id;
  end if;
 end loop;
 return v_batch;
end $$;

create or replace function radcontrack_private.save_room_usage(p_date date,p_room text,p_shift text,p_category text,p_quantities jsonb,p_patients integer,p_staff text,p_version integer) returns integer
language plpgsql security definer set search_path='' as $$
declare v_old public.stock_shift_usage; v_stock public.room_stock; v_id text; v_qty numeric; v_prev numeric; v_delta numeric; v_batch uuid:=gen_random_uuid();
begin
 perform radcontrack_private.assert_stock_user();
 if p_date is null or p_date>(now() at time zone 'Africa/Lagos')::date or p_room is null or p_room not in ('X-ray','CT','MRI','Fluoroscopy') or p_shift is null or p_shift not in ('morning','afternoon','night') or p_category is null or p_category not in ('films','supplies') or jsonb_typeof(p_quantities) is distinct from 'object' or p_patients is null or p_patients not between 0 and 10000 or length(btrim(coalesce(p_staff,'')))<2 then raise exception 'Complete the room, shift, name and usage'; end if;
 insert into public.stock_shift_usage(date,room,shift,category,recorded_by_name) values(p_date,p_room,p_shift,p_category,p_staff) on conflict do nothing;
 select * into v_old from public.stock_shift_usage where date=p_date and room=p_room and shift=p_shift and category=p_category for update;
 if p_version is distinct from v_old.version then raise exception 'Someone else updated this shift. Reload it before saving'; end if;
 if (select count(*) from jsonb_object_keys(p_quantities))>50 then raise exception 'Too many items'; end if;
 if p_category='films' and p_patients=0 and exists(select 1 from jsonb_each(p_quantities) where value::text::numeric>0) then raise exception 'Enter the number of patients printed for'; end if;
 for v_id in select key from jsonb_object_keys(p_quantities) as key union select key from jsonb_object_keys(v_old.quantities) as key order by 1 loop
  if not exists(select 1 from public.stock_items where id=v_id and (active or (v_old.quantities ? v_id and coalesce((p_quantities->>v_id)::numeric,0)=coalesce((v_old.quantities->>v_id)::numeric,0)))) or (p_category='films')<>(v_id in ('film1714','film1210')) then raise exception 'Choose an item from the correct usage section'; end if;
  if p_quantities ? v_id and (jsonb_typeof(p_quantities->v_id)<>'number' or (p_quantities->>v_id)!~'^[0-9]+(\.[0-9]{1,2})?$') then raise exception 'Usage must be whole numbers'; end if;
  v_qty:=coalesce((p_quantities->>v_id)::numeric,0); v_prev:=coalesce((v_old.quantities->>v_id)::numeric,0); v_delta:=v_qty-v_prev;
  if v_qty<>trunc(v_qty) and v_id not in ('ct_contrast','mri_contrast','gastrolux') then raise exception 'Only contrast volume may contain decimals'; end if;
  if v_qty not between 0 and 1000000 then raise exception 'Usage quantity is outside the allowed range'; end if;
  if v_delta<>0 then
   insert into public.room_stock(room,item_id) values(p_room,v_id) on conflict do nothing;
   select * into v_stock from public.room_stock where room=p_room and item_id=v_id for update;
   if p_date<v_stock.counted_on or (v_old.version>0 and v_old.updated_at<=v_stock.counted_at) then raise exception 'This earlier usage was included in a later physical count. Record a new count instead of changing the stock deduction'; end if;
   if v_stock.balance<v_delta then raise exception 'Not enough recorded stock in % for %. Record its pick or physical count first',p_room,(select name from public.stock_items where id=v_id); end if;
   update public.room_stock set balance=balance-v_delta where room=p_room and item_id=v_id;
   insert into public.room_stock_movements(batch_id,room,item_id,movement_type,change,balance_after,balance_known,occurred_on,shift,staff_name,recorded_by)
    values(v_batch,p_room,v_id,case when v_delta>0 then 'usage' else 'correction' end,-v_delta,v_stock.balance-v_delta,v_stock.counted_on is not null,p_date,p_shift,btrim(p_staff),auth.uid());
  end if;
 end loop;
 update public.stock_shift_usage set quantities=p_quantities,patients=p_patients,version=version+1,recorded_by_name=btrim(p_staff),updated_at=clock_timestamp() where date=p_date and room=p_room and shift=p_shift and category=p_category;
 return v_old.version+1;
end $$;

create or replace function radcontrack_private.save_room_usage_volume(p_date date,p_room text,p_shift text,p_category text,p_quantities jsonb,p_patients integer,p_staff text,p_version integer,p_volumes jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare v_effective jsonb:=p_quantities; v_details jsonb; v_meta jsonb; v_old jsonb; v_id text; v_admin numeric; v_waste numeric; v_version integer;
begin
 perform radcontrack_private.assert_stock_user();
 if jsonb_typeof(p_quantities) is distinct from 'object' or jsonb_typeof(p_volumes) is distinct from 'object' then raise exception 'Enter valid contrast volumes'; end if;
 if exists(select 1 from jsonb_object_keys(p_volumes) k where k not in ('ct_contrast','mri_contrast','gastrolux')) then raise exception 'Only contrast uses this volume breakdown'; end if;
 if p_category<>'supplies' and p_volumes<>'{}'::jsonb then raise exception 'Contrast belongs in Stock used'; end if;
 select quantities,contrast_volumes into v_old,v_meta from public.stock_shift_usage where date=p_date and room=p_room and shift=p_shift and category=p_category;
 v_meta:=coalesce(v_meta,'{}');
 foreach v_id in array array['ct_contrast','mri_contrast','gastrolux'] loop
  if p_volumes ? v_id or p_quantities ? v_id or coalesce(v_old,'{}') ? v_id then
   v_details:=p_volumes->v_id;
   if v_details->'keep_existing'='true'::jsonb then
    v_effective:=jsonb_set(v_effective,array[v_id],coalesce(v_old->v_id,'0'::jsonb));
   else
    if jsonb_typeof(v_details->'administered_ml') is distinct from 'number' or jsonb_typeof(v_details->'waste_ml') is distinct from 'number' or (v_details->>'administered_ml')!~'^[0-9]+(\.[0-9]{1,2})?$' or (v_details->>'waste_ml')!~'^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'Enter administered ml and discarded ml, or keep the earlier record unchanged'; end if;
    v_admin:=(v_details->>'administered_ml')::numeric; v_waste:=(v_details->>'waste_ml')::numeric;
    if v_admin<0 or v_waste<0 or v_admin+v_waste>1000000 then raise exception 'Contrast volumes are outside the allowed range'; end if;
    v_effective:=jsonb_set(v_effective,array[v_id],to_jsonb(v_admin+v_waste));
    v_meta:=jsonb_set(v_meta,array[v_id],jsonb_build_object('administered_ml',v_admin,'waste_ml',v_waste));
   end if;
  end if;
 end loop;
 v_version:=radcontrack_private.save_room_usage(p_date,p_room,p_shift,p_category,v_effective,p_patients,p_staff,p_version);
 update public.stock_shift_usage set contrast_volumes=v_meta where date=p_date and room=p_room and shift=p_shift and category=p_category;
 return v_version;
end $$;

-- Versioned endpoints stop cached bottle/pack clients from writing the wrong units.
create function public.move_room_stock_units(p_type text,p_date date,p_staff text,p_lines jsonb,p_room text default null,p_shift text default null,p_reference text default null,p_request uuid default null) returns uuid language sql security invoker set search_path='' as $$select radcontrack_private.move_room_stock(p_type,p_date,p_staff,p_lines,p_room,p_shift,p_reference,p_request)$$;
create function public.save_room_usage_units(p_date date,p_room text,p_shift text,p_category text,p_quantities jsonb,p_patients integer,p_staff text,p_version integer,p_volumes jsonb) returns integer language sql security invoker set search_path='' as $$select radcontrack_private.save_room_usage_volume(p_date,p_room,p_shift,p_category,p_quantities,p_patients,p_staff,p_version,p_volumes)$$;
revoke all on function public.move_room_stock_units(text,date,text,jsonb,text,text,text,uuid),public.save_room_usage_units(date,text,text,text,jsonb,integer,text,integer,jsonb) from public,anon;
grant execute on function public.move_room_stock_units(text,date,text,jsonb,text,text,text,uuid),public.save_room_usage_units(date,text,text,text,jsonb,integer,text,integer,jsonb) to authenticated;
revoke execute on function public.move_room_stock(text,date,text,jsonb,text,text,text,uuid), public.move_room_stock_volume(text,date,text,jsonb,text,text,text,uuid),public.record_stock_batch(text,date,text,jsonb,text,text),radcontrack_private.record_stock_batch(text,date,text,jsonb,text,text), public.save_room_usage(date,text,text,text,jsonb,integer,text,integer),public.save_room_usage_volume(date,text,text,text,jsonb,integer,text,integer,jsonb) from authenticated;

create function radcontrack_private.edit_stock_receipt(p_id uuid,p_version integer,p_quantity numeric,p_date date,p_recipient text,p_reference text,p_delete boolean) returns integer language plpgsql security definer set search_path='' as $$
declare v_row public.stock_movements;v_item public.stock_items;v_delta numeric;v_after public.stock_movements;
begin
 perform radcontrack_private.assert_stock_manager();
 -- All writers lock the item first, then its movement.
 select i.* into v_item from public.stock_items i join public.stock_movements m on m.item_id=i.id where m.id=p_id for update of i;
 if not found then raise exception 'Receipt not found';end if;
 select * into v_row from public.stock_movements where id=p_id for update;
 if v_row.movement_type<>'receipt' or v_row.voided_at is not null then raise exception 'Only active received-stock entries can be changed';end if;
 if p_version is distinct from v_row.version then raise exception 'This receipt changed. Reload before editing';end if;
 if p_delete is null then raise exception 'Choose an edit or deletion';end if;
 if not p_delete and (p_quantity is null or p_quantity<=0 or p_quantity>1000000 or p_quantity<>round(p_quantity,2) or (v_item.unit<>'ml' and p_quantity<>trunc(p_quantity)) or p_date is null or p_date>(now() at time zone 'Africa/Lagos')::date or length(btrim(coalesce(p_recipient,'')))<2) then raise exception 'Enter a valid date, recipient and quantity';end if;
 v_delta:=case when p_delete then -v_row.quantity else p_quantity-v_row.quantity end;
 if (v_item.counted_at is not null and v_row.created_at<=v_item.counted_at) or (v_item.counted_on is not null and (v_row.occurred_on<v_item.counted_on or (not p_delete and p_date<v_item.counted_on))) then raise exception 'This receipt is already covered by a later physical count. Record a new count instead';end if;
 if v_item.balance+v_delta<0 then raise exception 'The stock has already been picked. Correct the affected picks or count current stock first';end if;
 update public.stock_items set balance=balance+v_delta where id=v_item.id;
 update public.stock_movements set quantity=case when p_delete then quantity else p_quantity end,occurred_on=case when p_delete then occurred_on else p_date end,recipient_name=case when p_delete then recipient_name else btrim(p_recipient) end,reference=case when p_delete then reference else nullif(btrim(p_reference),'') end,version=version+1,voided_at=case when p_delete then clock_timestamp() end where id=p_id returning * into v_after;
 insert into radcontrack_private.stock_receipt_audit(receipt_id,before_record,after_record,changed_by) values(p_id,to_jsonb(v_row),to_jsonb(v_after),auth.uid());
 return v_after.version;
end $$;
create function public.edit_stock_receipt(p_id uuid,p_version integer,p_quantity numeric,p_date date,p_recipient text,p_reference text default null,p_delete boolean default false) returns integer language sql security invoker set search_path='' as $$select radcontrack_private.edit_stock_receipt(p_id,p_version,p_quantity,p_date,p_recipient,p_reference,p_delete)$$;
revoke all on function radcontrack_private.edit_stock_receipt(uuid,integer,numeric,date,text,text,boolean),public.edit_stock_receipt(uuid,integer,numeric,date,text,text,boolean) from public,anon;
grant execute on function radcontrack_private.edit_stock_receipt(uuid,integer,numeric,date,text,text,boolean),public.edit_stock_receipt(uuid,integer,numeric,date,text,text,boolean) to authenticated;

-- Approve existing, confirmed staff accounts. This endpoint cannot create another administrator.
create function radcontrack_private.set_stock_staff(p_email text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid;begin
 perform radcontrack_private.assert_stock_manager();
 select id into v_id from auth.users where lower(email)=lower(btrim(p_email)) and email_confirmed_at is not null;
 if v_id is null then raise exception 'Ask this staff member to register and confirm their email first';end if;
 if exists(select 1 from radcontrack_private.inventory_members where user_id=v_id and role='manager') then raise exception 'The administrator account cannot be changed here';end if;
 if p_active is null then raise exception 'Choose whether to allow access';end if;
 insert into radcontrack_private.inventory_members(user_id,role,active) values(v_id,'staff',p_active) on conflict(user_id) do update set active=excluded.active;
end $$;
create function public.set_stock_staff(p_email text,p_active boolean) returns void language sql security invoker set search_path='' as $$select radcontrack_private.set_stock_staff(p_email,p_active)$$;
revoke all on function radcontrack_private.set_stock_staff(text,boolean),public.set_stock_staff(text,boolean) from public,anon;
grant execute on function radcontrack_private.set_stock_staff(text,boolean),public.set_stock_staff(text,boolean) to authenticated;
commit;
