\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select public.move_room_stock_units('issue',current_date,'Honey','[{"item_id":"ct_contrast","quantity":100}]','CT','morning');
select public.save_shift(current_date,'CT','morning','{"ct_contrast":{"used":70,"waste":10,"patients":2}}','Honey',0,0,0,false,'{}','','');
do $$declare ctx jsonb;begin
 if (select balance from public.room_stock where room='CT' and item_id='ct_contrast')<>20 then raise exception 'Usage plus waste must deduct 80 ml';end if;
 if (select details#>>'{ct_contrast,patients}' from public.room_shift_reviews where room='CT')<>'2' then raise exception 'Patients not saved';end if;
 ctx:=public.shift_context(current_date,'CT','afternoon');
 if (select (value->>'opening')::numeric from jsonb_array_elements(ctx->'items') where value->>'id'='ct_contrast')<>20 then raise exception 'Next shift did not carry 20';end if;
 ctx:=public.shift_context(current_date+1,'CT','morning');
 if (select (value->>'opening')::numeric from jsonb_array_elements(ctx->'items') where value->>'id'='ct_contrast')<>20 then raise exception 'Next day did not carry 20';end if;
 begin perform public.save_shift(current_date,'CT','morning','{"ct_contrast":{"used":80,"waste":0,"patients":2}}','Honey',0,1,1,false,'{}','','');raise exception 'Stale version accepted';exception when others then if sqlerrm not like 'This shift changed%' then raise;end if;end;
 begin perform public.save_shift(current_date,'CT','morning','{}','Honey',1,1,1,true,'{}','','bad');raise exception 'Stale stock token accepted';exception when others then if sqlerrm not like 'Room stock changed%' then raise;end if;end;
end $$;
select public.move_room_stock_units('issue',current_date,'Honey','[{"item_id":"ct_contrast","quantity":50}]','CT','morning');
select public.save_shift(current_date,'CT','morning','{"ct_contrast":{"used":60,"waste":10,"patients":2}}','Honey',1,1,1,false,'{}','','');
do $$declare ctx jsonb; d jsonb:='{}';p jsonb:='{}'; item jsonb;begin
 if (select balance from public.room_stock where room='CT' and item_id='ct_contrast')<>80 then raise exception 'Top-up and correction must leave 80';end if;
 ctx:=public.shift_context(current_date,'CT','morning');
 for item in select value from jsonb_array_elements(ctx->'items') loop
  d:=jsonb_set(d,array[item->>'id'],jsonb_build_object('used',case when item->>'id'='ct_contrast' then 60 else 0 end,'waste',case when item->>'id'='ct_contrast' then 10 else 0 end,'patients',case when item->>'id'='ct_contrast' then 2 else 0 end,'reviewed',true));
  p:=jsonb_set(p,array[item->>'id'],item->'remaining');
 end loop;
 begin perform public.save_shift(current_date,'CT','morning',d-'gloves_pack','Honey',2,2,2,true,p,'Opening count not yet confirmed',ctx->>'token');raise exception 'Unreviewed glove entry accepted';exception when others then if sqlerrm not like 'Review every item%' then raise;end if;end;
 perform public.save_shift(current_date,'CT','morning',d,'Honey',2,2,2,true,p,'Opening count not yet confirmed',ctx->>'token');
 if not (select finished from public.room_shift_reviews where room='CT') then raise exception 'Shift did not finish';end if;
end $$;
select public.move_room_stock_units('issue',current_date,'Honey','[{"item_id":"ct_contrast","quantity":10}]','CT','morning');
do $$begin
 if (select finished from public.room_shift_reviews where room='CT') then raise exception 'Top-up must reopen review';end if;
 begin perform public.save_room_usage_units(current_date,'CT','morning','supplies','{}',0,'Honey',3,'{}');raise exception 'Old duplicate writer accepted';exception when others then if sqlerrm not like 'Use the connected daily entry%' then raise;end if;end;
end $$;
select public.move_room_stock_units('issue',current_date,'Honey','[{"item_id":"film1714","quantity":10},{"item_id":"film1210","quantity":10}]','Mammography','morning');
select public.save_shift(current_date,'Mammography','morning','{"film1714":{"used":4,"patients":2},"film1210":{"used":3,"patients":1}}','Honey',0,0,0,false,'{}','','');
do $$begin
 if (select balance from public.room_stock where room='Mammography' and item_id='film1714')<>6 then raise exception 'Large films incorrect';end if;
 if (select balance from public.room_stock where room='Mammography' and item_id='film1210')<>7 then raise exception 'Small films incorrect';end if;
 if (select details#>>'{film1210,patients}' from public.room_shift_reviews where room='Mammography')<>'1' then raise exception 'Per-size patients incorrect';end if;
end $$;
reset role;
do $$begin
 if has_function_privilege('anon','public.save_shift(date,text,text,jsonb,text,integer,integer,integer,boolean,jsonb,text,text)','execute') then raise exception 'Anonymous save permission';end if;
 if not (select relrowsecurity from pg_class where oid='public.room_shift_reviews'::regclass) then raise exception 'Review RLS missing';end if;
end $$;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
set local role authenticated;
do $$begin
 begin perform public.shift_context(current_date,'CT','morning');raise exception 'Unapproved access allowed';exception when others then if sqlerrm='Unapproved access allowed' then raise;end if;end;
end $$;
rollback;
select 'Unified stock deductions, wastage, patients, corrections, carryover, top-ups, finish checks and per-size films passed' result;
