-- Recover the active pre-transition day without changing its original clinical JSON.
-- CT/Gastrolux belong to CT; MRI belongs to MRI. Gastrolux location confirmed by HOD.
begin;
create table public.clinical_stock_transitions (
 date date primary key references public.daily_contrast_data(date),
 original_data jsonb not null,
 imported_at timestamptz not null default clock_timestamp()
);
alter table public.clinical_stock_transitions enable row level security;
create policy approved_read on public.clinical_stock_transitions for select to authenticated
 using (radcontrack_private.inventory_role() is not null);
grant select on public.clinical_stock_transitions to authenticated;
revoke insert,update,delete on public.clinical_stock_transitions from anon,authenticated;

do $recover$
declare
 v_date date:='2026-10-07'; v_data jsonb; v_actor uuid;
 v_id text; v_room text; v_keys text[]; v_key text; v_shift text;
 v_open numeric; v_extra numeric; v_used numeric; v_pat integer;
 v_running numeric; v_prior numeric; v_details jsonb; v_volumes jsonb; v_quantities jsonb;
 v_staff text; v_batch uuid:=gen_random_uuid();
 v_prior_actor text:=current_setting('request.jwt.claim.sub',true);
begin
 select data into v_data from public.daily_contrast_data where date=v_date for update;
 if not found then return; end if;
 if exists(select 1 from public.clinical_stock_transitions where date=v_date) then return;end if;
 select u.id into v_actor from auth.users u join radcontrack_private.inventory_members m on m.user_id=u.id
 where lower(u.email) in ('honey.onabanjo@bthdc.com.ng','btradiographers@gmail.com')
 order by case when lower(u.email)='honey.onabanjo@bthdc.com.ng' then 0 else 1 end limit 1;
 if v_actor is null then raise exception 'An approved radiology account is required to recover the clinical day';end if;
 -- Existing update-audit triggers require an actor even in the SQL editor.
 perform set_config('request.jwt.claim.sub',v_actor::text,true);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('clinical/'||v_date::text,0));
 perform 1 from public.stock_items order by id for update;
 if exists(select 1 from public.room_stock_movements where voided_at is null and occurred_on>=v_date
  and ((room='CT' and item_id in ('ct_contrast','gastrolux')) or (room='MRI' and item_id='mri_contrast'))) then
  raise exception 'Contrast room movements already exist on or after 7 October. Reconcile them before recovering this day; no changes applied';
 end if;
 if exists(select 1 from public.room_shift_reviews r,jsonb_each(r.details) d where r.date=v_date
  and d.key in ('ct_contrast','gastrolux','mri_contrast')) then
  raise exception 'Connected contrast entries already exist for 7 October; no changes applied';
 end if;
 insert into public.clinical_stock_transitions(date,original_data) values(v_date,v_data);
 foreach v_id in array array['ct_contrast','gastrolux','mri_contrast'] loop
  v_room:=case when v_id='mri_contrast' then 'MRI' else 'CT' end;
  v_keys:=case v_id when 'ct_contrast' then array['jodascan300','hexopack350'] when 'mri_contrast' then array['mriContrast'] else array['gastrolux'] end;
  v_open:=0;
  foreach v_key in array v_keys loop
   v_open:=v_open+coalesce((v_data#>>array['morning',v_key,'received','mls'])::numeric,0);
  end loop;
  if v_open<0 then raise exception 'Negative opening stock in original record';end if;
  insert into public.room_stock(room,item_id) values(v_room,v_id) on conflict do nothing;
  select balance into v_prior from public.room_stock where room=v_room and item_id=v_id for update;
  -- This is a historical opening baseline, not a collection from the departmental store.
  insert into public.room_stock_movements(batch_id,room,item_id,movement_type,change,balance_after,balance_known,occurred_on,shift,staff_name,recorded_by)
  values(v_batch,v_room,v_id,'count',v_open-v_prior,v_open,true,v_date,'morning','Opening from saved clinical record',v_actor);
  v_running:=v_open;
  foreach v_shift in array array['morning','afternoon','night'] loop
   v_extra:=0;v_used:=0;v_pat:=0;
   foreach v_key in array v_keys loop
    v_extra:=v_extra+coalesce((v_data#>>array[v_shift,v_key,'additionalReceived','mls'])::numeric,0);
    v_used:=v_used+coalesce((v_data#>>array[v_shift,v_key,'consumption','mls'])::numeric,0);
    v_pat:=v_pat+coalesce((v_data#>>array[v_shift,v_key,'patients'])::integer,0);
   end loop;
   if v_extra<0 or v_used<0 or v_pat<0 or v_running+v_extra-v_used<0 then raise exception 'Invalid stock chain for % / %. No changes applied',v_id,v_shift;end if;
   v_staff:=coalesce(nullif(v_data#>>array[v_shift,'metadata','calculatedBy'],''),'Recovered clinical record');
   if v_extra>0 then
    v_running:=v_running+v_extra;
    insert into public.room_stock_movements(batch_id,room,item_id,movement_type,change,balance_after,balance_known,occurred_on,shift,staff_name,recorded_by)
    values(v_batch,v_room,v_id,'pick',v_extra,v_running,true,v_date,v_shift,v_staff,v_actor);
   end if;
   v_running:=v_running-v_used;
   if v_used>0 then
    insert into public.room_stock_movements(batch_id,room,item_id,movement_type,change,balance_after,balance_known,occurred_on,shift,staff_name,recorded_by)
    values(v_batch,v_room,v_id,'usage',-v_used,v_running,true,v_date,v_shift,v_staff,v_actor);
   end if;
   v_details:=jsonb_build_object(v_id,jsonb_build_object('used',v_used,'waste',0,'patients',v_pat,'reviewed',false));
   v_quantities:=jsonb_build_object(v_id,v_used);
   v_volumes:=jsonb_build_object(v_id,jsonb_build_object('administered_ml',v_used,'waste_ml',0));
   insert into public.stock_shift_usage(date,room,shift,category,quantities,contrast_volumes,recorded_by_name,version)
   values(v_date,v_room,v_shift,'supplies',v_quantities,v_volumes,v_staff,1)
   on conflict(date,room,shift,category) do update set quantities=stock_shift_usage.quantities||excluded.quantities,
    contrast_volumes=stock_shift_usage.contrast_volumes||excluded.contrast_volumes,version=stock_shift_usage.version+1;
   insert into public.room_shift_reviews(date,room,shift,details,staff,note,version,finished)
   values(v_date,v_room,v_shift,v_details,v_staff,'Recovered from original clinical entry; wastage was not recorded separately. Review before finishing.',1,false)
   on conflict(date,room,shift) do update set details=room_shift_reviews.details||excluded.details,finished=false,version=room_shift_reviews.version+1;
  end loop;
  update public.room_stock set balance=v_running,counted_on=v_date,
   counted_at=(select min(created_at) from public.room_stock_movements where batch_id=v_batch and room=v_room and item_id=v_id and movement_type='count')
   where room=v_room and item_id=v_id;
 end loop;
 update public.stock_shift_usage set updated_at=clock_timestamp() where date=v_date and room in ('CT','MRI') and category='supplies';
 update public.room_shift_reviews r set stock_token=radcontrack_private.shift_context(r.date,r.room,r.shift)->>'token'
 where r.date=v_date and r.room in ('CT','MRI');
 insert into radcontrack_private.stock_correction_audit(source,record_id,before_record,after_record,reason,changed_by)
 values('usage','clinical-transition/'||v_date::text,v_data,jsonb_build_object('date',v_date,'rooms',array['CT','MRI']),
 'Recovered unfinished saved clinical shifts into room stock; original record preserved',v_actor);
 perform set_config('request.jwt.claim.sub',coalesce(v_prior_actor,''),true);
end $recover$;

-- Only the recovered day bypasses the old/new duplicate guard.
do $guard$
declare v_definition text;
begin
 select pg_get_functiondef('radcontrack_private.save_shift(date,text,text,jsonb,text,integer,integer,integer,boolean,jsonb,text,text)'::regprocedure) into v_definition;
 v_definition:=replace(v_definition,'where d.date=p_date and s.key=p_shift','where d.date=p_date and not exists(select 1 from public.clinical_stock_transitions t where t.date=d.date) and s.key=p_shift');
 execute v_definition;
end $guard$;
commit;
