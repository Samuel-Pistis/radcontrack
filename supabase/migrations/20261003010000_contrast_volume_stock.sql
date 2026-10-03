-- Keep contrast room balances in exact ml, not rounded fractional bottles.
begin;
alter table public.room_stock alter column balance type numeric(18,2);
alter table public.room_stock_movements alter column change type numeric(18,2);
alter table public.room_stock_movements alter column balance_after type numeric(18,2);
alter table public.stock_shift_usage add column contrast_volumes jsonb not null default '{}';
update public.room_stock set balance=balance*case item_id when 'ct_contrast' then 100 else 15 end where item_id in ('ct_contrast','mri_contrast');
update public.room_stock_movements set change=change*case item_id when 'ct_contrast' then 100 else 15 end,balance_after=balance_after*case item_id when 'ct_contrast' then 100 else 15 end where item_id in ('ct_contrast','mri_contrast');
update public.stock_shift_usage set quantities=(select jsonb_object_agg(key,case key when 'ct_contrast' then to_jsonb(value::text::numeric*100) when 'mri_contrast' then to_jsonb(value::text::numeric*15) else value end) from jsonb_each(quantities)),version=version+1 where quantities ? 'ct_contrast' or quantities ? 'mri_contrast';

create or replace function radcontrack_private.move_room_stock(p_type text,p_date date,p_staff text,p_lines jsonb,p_room text,p_shift text,p_reference text,p_request uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_batch uuid:=coalesce(p_request,gen_random_uuid()); v_line jsonb; v_item public.stock_items; v_room public.room_stock; v_qty numeric; v_factor integer; v_after numeric; v_payload jsonb; v_existing jsonb;
begin
 perform radcontrack_private.assert_stock_user();
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
  if v_qty<>trunc(v_qty) and not(p_type='room_count' and v_item.id in ('ct_contrast','mri_contrast')) then raise exception 'Only contrast room counts accept decimal millilitres'; end if;
  v_factor:=case when v_item.id in ('film1714','film1210') then 100 when v_item.id='ct_contrast' then 100 when v_item.id='mri_contrast' then 15 else 1 end;
  if p_type<>'room_count' then
   if p_type<>'opening' and p_date<v_item.counted_on then raise exception 'This movement predates the latest store count. Do not add stock already included in that count'; end if;
   if p_type='issue' and v_item.balance<v_qty then raise exception 'Not enough recorded % in the store. Record a physical count or missing collection first',v_item.name; end if;
   v_after:=case p_type when 'opening' then v_qty when 'issue' then v_item.balance-v_qty else v_item.balance+v_qty end;
   insert into public.stock_movements(batch_id,item_id,movement_type,quantity,balance_after,balance_known,occurred_on,recipient_name,destination,shift,reference,recorded_by)
    values(v_batch,v_item.id,p_type,v_qty,v_after,v_item.opening_recorded or p_type='opening',p_date,btrim(p_staff),case when p_type='issue' then p_room end,p_shift,p_reference,auth.uid());
   update public.stock_items set balance=v_after,opening_recorded=opening_recorded or p_type='opening',counted_on=case when p_type='opening' then p_date else counted_on end where id=v_item.id;
  end if;
  if p_type in ('issue','room_count') then
   insert into public.room_stock(room,item_id) values(p_room,v_item.id) on conflict do nothing;
   select * into v_room from public.room_stock where room=p_room and item_id=v_item.id for update;
   if p_type='issue' and p_date<v_room.counted_on then raise exception 'This pick predates the room count and may already be included in it'; end if;
   -- A room count uses individual films; picks use store packs (100 films each).
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
  if not exists(select 1 from public.stock_items where id=v_id and active) or (p_category='films')<>(v_id in ('film1714','film1210')) then raise exception 'Choose an item from the correct usage section'; end if;
  if p_quantities ? v_id and (jsonb_typeof(p_quantities->v_id)<>'number' or (p_quantities->>v_id)!~'^[0-9]+(\.[0-9]{1,2})?$') then raise exception 'Usage must be whole numbers'; end if;
  v_qty:=coalesce((p_quantities->>v_id)::numeric,0); v_prev:=coalesce((v_old.quantities->>v_id)::numeric,0); v_delta:=v_qty-v_prev;
  if v_qty<>trunc(v_qty) and v_id not in ('ct_contrast','mri_contrast') then raise exception 'Only CT and MRI volume may contain decimals'; end if;
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

-- Reject old clients that still send bottle counts as if they were ml.
create function public.move_room_stock_volume(p_type text,p_date date,p_staff text,p_lines jsonb,p_room text default null,p_shift text default null,p_reference text default null,p_request uuid default null) returns uuid language sql security invoker set search_path='' as $$select radcontrack_private.move_room_stock(p_type,p_date,p_staff,p_lines,p_room,p_shift,p_reference,p_request)$$;
revoke all on function public.move_room_stock_volume(text,date,text,jsonb,text,text,text,uuid) from public,anon;
grant execute on function public.move_room_stock_volume(text,date,text,jsonb,text,text,text,uuid) to authenticated;
create or replace function public.move_room_stock(p_type text,p_date date,p_staff text,p_lines jsonb,p_room text default null,p_shift text default null,p_reference text default null,p_request uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
begin
 if p_type='room_count' and exists(select 1 from jsonb_array_elements(p_lines) where value->>'item_id' in ('ct_contrast','mri_contrast')) then raise exception 'Refresh the app to count CT and MRI room stock in millilitres';end if;
 return radcontrack_private.move_room_stock(p_type,p_date,p_staff,p_lines,p_room,p_shift,p_reference,p_request);
end $$;
create or replace function public.save_room_usage(p_date date,p_room text,p_shift text,p_category text,p_quantities jsonb,p_patients integer,p_staff text,p_version integer) returns integer language plpgsql security invoker set search_path='' as $$
begin
 if p_quantities ? 'ct_contrast' or p_quantities ? 'mri_contrast' or exists(select 1 from public.stock_shift_usage where date=p_date and room=p_room and shift=p_shift and category=p_category and (quantities ? 'ct_contrast' or quantities ? 'mri_contrast')) then raise exception 'Refresh the app to enter CT and MRI volumes in millilitres'; end if;
 return radcontrack_private.save_room_usage(p_date,p_room,p_shift,p_category,p_quantities,p_patients,p_staff,p_version);
end $$;

create function radcontrack_private.save_room_usage_volume(p_date date,p_room text,p_shift text,p_category text,p_quantities jsonb,p_patients integer,p_staff text,p_version integer,p_volumes jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare v_effective jsonb:=p_quantities; v_details jsonb; v_meta jsonb; v_old jsonb; v_id text; v_admin numeric; v_waste numeric; v_version integer;
begin
 perform radcontrack_private.assert_stock_user();
 if jsonb_typeof(p_quantities) is distinct from 'object' or jsonb_typeof(p_volumes) is distinct from 'object' then raise exception 'Enter valid contrast volumes'; end if;
 if exists(select 1 from jsonb_object_keys(p_volumes) k where k not in ('ct_contrast','mri_contrast')) then raise exception 'Only CT and MRI use this conversion'; end if;
 if p_category<>'supplies' and p_volumes<>'{}'::jsonb then raise exception 'Contrast belongs in Stock used'; end if;
 select quantities,contrast_volumes into v_old,v_meta from public.stock_shift_usage where date=p_date and room=p_room and shift=p_shift and category=p_category;
 v_meta:=coalesce(v_meta,'{}');
 foreach v_id in array array['ct_contrast','mri_contrast'] loop
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
revoke all on function radcontrack_private.save_room_usage_volume(date,text,text,text,jsonb,integer,text,integer,jsonb) from public,anon;
grant execute on function radcontrack_private.save_room_usage_volume(date,text,text,text,jsonb,integer,text,integer,jsonb) to authenticated;
create function public.save_room_usage_volume(p_date date,p_room text,p_shift text,p_category text,p_quantities jsonb,p_patients integer,p_staff text,p_version integer,p_volumes jsonb) returns integer language sql security invoker set search_path='' as $$select radcontrack_private.save_room_usage_volume(p_date,p_room,p_shift,p_category,p_quantities,p_patients,p_staff,p_version,p_volumes)$$;
revoke all on function public.save_room_usage_volume(date,text,text,text,jsonb,integer,text,integer,jsonb) from public,anon;
grant execute on function public.save_room_usage_volume(date,text,text,text,jsonb,integer,text,integer,jsonb) to authenticated;
commit;
