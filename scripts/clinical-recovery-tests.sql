\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
do $$declare ctx jsonb;begin
 if (select balance from public.room_stock where room='CT' and item_id='ct_contrast')<>135 then raise exception 'CT carryover must be 135';end if;
 if (select balance from public.room_stock where room='CT' and item_id='gastrolux')<>220 then raise exception 'Gastrolux carryover must be 220';end if;
 if (select balance from public.room_stock where room='MRI' and item_id='mri_contrast')<>4 then raise exception 'MRI carryover must be 4';end if;
 if (select details#>>'{ct_contrast,used}' from public.room_shift_reviews where date='2026-10-07' and room='CT' and shift='morning')<>'685' then raise exception 'Morning missing';end if;
 if (select details#>>'{ct_contrast,used}' from public.room_shift_reviews where date='2026-10-07' and room='CT' and shift='afternoon')<>'380' then raise exception 'Afternoon missing';end if;
 if exists(select 1 from public.room_shift_reviews where date='2026-10-07' and finished) then raise exception 'Recovered shifts must remain unfinished';end if;
 if (select original_data from public.clinical_stock_transitions where date='2026-10-07') is distinct from (select data from public.daily_contrast_data where date='2026-10-07') then raise exception 'Original record changed';end if;
 ctx:=public.shift_context('2026-10-08','CT','morning');
 if (select (value->>'opening')::numeric from jsonb_array_elements(ctx->'items') where value->>'id'='ct_contrast')<>135 then raise exception 'Next day opening incorrect';end if;
end $$;
select public.save_shift('2026-10-08','CT','morning','{"ct_contrast":{"used":100,"waste":5,"patients":2}}','Honey',0,0,0,false,'{}','','');
do $$begin
 if (select balance from public.room_stock where room='CT' and item_id='ct_contrast')<>30 then raise exception 'New day usage deducted incorrectly';end if;
end $$;
select public.move_room_stock_units('issue','2026-10-08','Honey','[{"item_id":"ct_contrast","quantity":100}]','CT','afternoon');
do $$declare ctx jsonb;r public.room_shift_reviews;f integer;s integer;begin
 ctx:=public.shift_context('2026-10-08','CT','afternoon');
 if (select (value->>'remaining')::numeric from jsonb_array_elements(ctx->'items') where value->>'id'='ct_contrast')<>130 then raise exception 'Topup not added';end if;
 select * into r from public.room_shift_reviews where date='2026-10-07' and room='CT' and shift='morning';
 select coalesce(max(version),0) into f from public.stock_shift_usage where date=r.date and room=r.room and shift=r.shift and category='films';
 select version into s from public.stock_shift_usage where date=r.date and room=r.room and shift=r.shift and category='supplies';
 perform public.save_shift(r.date,r.room,r.shift,jsonb_set(r.details,'{ct_contrast,used}','700'),'Honey',r.version,f,s,false,'{}','','');
 if (select balance from public.room_stock where room='CT' and item_id='ct_contrast')<>115 then raise exception 'Corrected old usage did not deduct only the 15 ml difference';end if;
 ctx:=public.shift_context('2026-10-08','CT','morning');
 if (select (value->>'opening')::numeric from jsonb_array_elements(ctx->'items') where value->>'id'='ct_contrast')<>120 then raise exception 'Correction did not update carryover';end if;
end $$;
reset role;
do $$begin
 if exists(select 1 from recovery_store_before b join stock_items i on i.id=b.id where i.id<>'ct_contrast' and i.balance<>b.balance) then raise exception 'Recovery changed departmental store stock';end if;
 if (select balance from stock_items where id='ct_contrast')<>(select balance-100 from recovery_store_before where id='ct_contrast') then raise exception 'Only the actual new topup may deduct departmental stock';end if;
 if not exists(select 1 from radcontrack_private.stock_correction_audit where record_id='clinical-transition/2026-10-07') then raise exception 'Recovery audit missing';end if;
end $$;
rollback;
select 'Clinical recovery, preserved originals, editing, carryover, wastage and topups passed' result;
