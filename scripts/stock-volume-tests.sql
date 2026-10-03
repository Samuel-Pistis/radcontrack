\set ON_ERROR_STOP on
begin;
do $$begin
 if (select balance from public.room_stock where room='Fluoroscopy' and item_id='ct_contrast')<>200 then raise exception 'Earlier room balance conversion failed';end if;
 if not exists(select 1 from public.stock_shift_usage where room='Fluoroscopy' and quantities->>'ct_contrast'='100' and version=2 and contrast_volumes='{}') then raise exception 'Earlier usage conversion invented a breakdown or lost the total';end if;
 if not exists(select 1 from public.room_stock_movements where room='Fluoroscopy' and change=-100 and balance_after=200) then raise exception 'Earlier movement conversion failed';end if;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
select set_config('request.jwt.claims','{"email":"btradiographers@gmail.com"}',true);
set local role authenticated;
select public.move_room_stock('receipt',current_date,'Tope','[{"item_id":"ct_contrast","quantity":3},{"item_id":"mri_contrast","quantity":4}]');
select public.move_room_stock('issue',current_date,'Tope','[{"item_id":"ct_contrast","quantity":2},{"item_id":"mri_contrast","quantity":3}]','CT','morning');
do $$begin if (select balance from public.room_stock where room='CT' and item_id='ct_contrast')<>200 or (select balance from public.room_stock where room='CT' and item_id='mri_contrast')<>45 then raise exception 'Bottle capacity transfer failed';end if;end $$;
select public.save_room_usage_volume(current_date,'CT','morning','supplies','{}',0,'Tope',0,'{"ct_contrast":{"administered_ml":130,"waste_ml":10},"mri_contrast":{"administered_ml":38,"waste_ml":0}}');
do $$begin if (select balance from public.room_stock where room='CT' and item_id='ct_contrast')<>60 or (select balance from public.room_stock where room='CT' and item_id='mri_contrast')<>7 then raise exception 'Usable leftovers were rounded away';end if;end $$;
-- A repeat is not another deduction; a correction deducts only its difference.
select public.save_room_usage_volume(current_date,'CT','morning','supplies','{}',0,'Tope',1,'{"ct_contrast":{"administered_ml":130,"waste_ml":10},"mri_contrast":{"administered_ml":38,"waste_ml":0}}');
select public.save_room_usage_volume(current_date,'CT','morning','supplies','{}',0,'Tope',2,'{"ct_contrast":{"administered_ml":125.25,"waste_ml":10},"mri_contrast":{"administered_ml":37.25,"waste_ml":0.5}}');
do $$begin if (select balance from public.room_stock where room='CT' and item_id='ct_contrast')<>64.75 or (select balance from public.room_stock where room='CT' and item_id='mri_contrast')<>7.25 or (select balance from public.stock_items where id='ct_contrast')<>1 then raise exception 'Correction or decimal precision failed';end if;end $$;
-- Keep earlier totals without inventing an administered/waste breakdown.
select public.save_room_usage_volume(current_date,'CT','morning','supplies','{}',0,'Tope',3,'{"ct_contrast":{"keep_existing":true},"mri_contrast":{"keep_existing":true}}');
do $$begin
 if (select quantities->>'ct_contrast' from public.stock_shift_usage where room='CT' and shift='morning')::numeric<>135.25 then raise exception 'Earlier volume lost';end if;
 begin perform public.save_room_usage(current_date,'CT','morning','supplies','{"ct_contrast":1}',0,'Tope',4);raise exception 'Old bottle client accepted';exception when others then if sqlerrm not like 'Refresh the app%' then raise;end if;end;
 begin perform public.save_room_usage_volume(current_date,'CT','afternoon','supplies','{}',0,'Tope',0,'{"ct_contrast":{"administered_ml":100,"waste_ml":0}}');raise exception 'Overdraw accepted';exception when others then if sqlerrm not like 'Not enough recorded%' then raise;end if;end;
 if exists(select 1 from public.stock_shift_usage where room='CT' and shift='afternoon') then raise exception 'Failed usage left a partial record';end if;
end $$;
select public.move_room_stock_volume('room_count',current_date,'Tope','[{"item_id":"mri_contrast","quantity":7.25}]','CT');
do $$begin if (select balance from public.room_stock where room='CT' and item_id='mri_contrast')<>7.25 then raise exception 'Partial bottle physical count failed';end if;end $$;
reset role;
select set_config('request.jwt.claims','{"email":"other@example.com"}',true);
set local role authenticated;
do $$begin begin perform public.save_room_usage_volume(current_date,'MRI','night','supplies','{}',0,'Other',0,'{}');raise exception 'Unauthorized usage accepted';exception when others then if sqlerrm not like 'Sign in with the radiology account%' then raise;end if;end;end $$;
rollback;
select 'Contrast volume tests passed; all test stock rolled back' result;


