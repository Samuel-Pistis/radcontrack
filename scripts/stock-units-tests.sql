\set ON_ERROR_STOP on
begin;
do $$begin
 if (select balance from public.stock_items where id='ct_contrast')<>200 or (select balance from public.stock_items where id='mri_contrast')<>45 or (select balance from public.stock_items where id='gastrolux')<>400 or (select balance from public.stock_items where id='film1714')<>500 then raise exception 'Store base-unit conversion failed';end if;
 if (select balance from public.room_stock where room='Fluoroscopy' and item_id='ct_contrast')<>200 or (select balance from public.room_stock where room='Fluoroscopy' and item_id='mri_contrast')<>45 or (select balance from public.room_stock where room='Fluoroscopy' and item_id='film1714')<>100 or (select balance from public.room_stock where room='Fluoroscopy' and item_id='gastrolux')<>200 then raise exception 'Room conversion doubled existing ml or films';end if;
 if not exists(select 1 from public.stock_shift_usage where quantities='{"ct_contrast":20,"mri_contrast":15,"gastrolux":100}' and version=2 and contrast_volumes='{}') then raise exception 'Legacy usage conversion failed';end if;
 if not exists(select 1 from public.stock_movements where item_id='film1714' and quantity=500 and balance_after=500) or not exists(select 1 from public.room_stock_movements where item_id='gastrolux' and change=-100 and balance_after=200) then raise exception 'History conversion failed';end if;
 if (select balance from public.stock_items where id='cd')<>50 or (select balance from public.stock_items where id='gloves_pack')<>3 or (select active from public.stock_items where id='gloves_piece') then raise exception 'CD or gloves units changed incorrectly';end if;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
select set_config('request.jwt.claims','{"email":"btradiographers@gmail.com"}',true);
set local role authenticated;
select public.set_stock_staff('staff@example.com',true);
select public.move_room_stock_units('receipt',current_date,'Admin','[{"item_id":"ct_contrast","quantity":100},{"item_id":"mri_contrast","quantity":15},{"item_id":"gastrolux","quantity":100},{"item_id":"film1714","quantity":100}]',null,null,'TEST RECEIPT','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
-- Idempotent retry cannot double add the receipt.
select public.move_room_stock_units('receipt',current_date,'Admin','[{"item_id":"ct_contrast","quantity":100},{"item_id":"mri_contrast","quantity":15},{"item_id":"gastrolux","quantity":100},{"item_id":"film1714","quantity":100}]',null,null,'TEST RECEIPT','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
do $$declare r public.stock_movements;begin
 if (select balance from public.stock_items where id='ct_contrast')<>300 then raise exception 'Receipt retry doubled stock';end if;
 select * into r from public.stock_movements where reference='TEST RECEIPT' and item_id='ct_contrast';
 perform public.edit_stock_receipt(r.id,r.version,125,current_date,'Admin','CORRECTED',false);
 if (select balance from public.stock_items where id='ct_contrast')<>325 then raise exception 'Receipt correction balance wrong';end if;
 begin perform public.edit_stock_receipt(r.id,r.version,130,current_date,'Admin',null,false);raise exception 'Stale correction accepted';exception when others then if sqlerrm not like 'This receipt changed%' then raise;end if;end;
 select * into r from public.stock_movements where id=r.id;
 perform public.edit_stock_receipt(r.id,r.version,r.quantity,r.occurred_on,r.recipient_name,null,true);
 if (select balance from public.stock_items where id='ct_contrast')<>200 then raise exception 'Receipt deletion balance wrong';end if;
 begin perform public.edit_stock_receipt(r.id,r.version+1,r.quantity,r.occurred_on,r.recipient_name,null,true);raise exception 'Double deletion accepted';exception when others then if sqlerrm not like 'Only active received%' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
-- A forged administrator email claim cannot grant privileges to a staff UID.
select set_config('request.jwt.claims','{"email":"btradiographers@gmail.com","user_metadata":{"role":"manager"}}',true);
set local role authenticated;
do $$begin
 if (public.inventory_permissions()->>'can_manage_stock')::boolean then raise exception 'Staff became manager';end if;
 begin perform public.move_room_stock_units('receipt',current_date,'Staff','[{"item_id":"cd","quantity":5}]');raise exception 'Staff receipt accepted';exception when others then if sqlerrm not like 'Only the stock administrator%' then raise;end if;end;
 begin perform public.move_room_stock_units('opening',current_date,'Staff','[{"item_id":"cd","quantity":5}]');raise exception 'Staff store count accepted';exception when others then if sqlerrm not like 'Only the stock administrator%' then raise;end if;end;
 begin perform public.edit_stock_receipt((select id from public.stock_movements where reference='TEST RECEIPT' limit 1),1,5,current_date,'Staff',null,true);raise exception 'Staff deletion accepted';exception when others then if sqlerrm not like 'Only the stock administrator%' then raise;end if;end;
 begin perform public.set_stock_staff('outsider@example.com',true);raise exception 'Staff role management accepted';exception when others then if sqlerrm not like 'Only the stock administrator%' then raise;end if;end;
 begin update public.stock_items set balance=999 where id='cd';raise exception 'Direct ledger write accepted';exception when insufficient_privilege then null;end;
 begin update radcontrack_private.inventory_members set role='manager' where user_id=auth.uid();raise exception 'Direct privilege escalation accepted';exception when insufficient_privilege then null;end;
 begin perform public.move_room_stock_volume('receipt',current_date,'Staff','[{"item_id":"cd","quantity":5}]');raise exception 'Cached old units accepted';exception when insufficient_privilege then null;end;
end $$;
select public.move_room_stock_units('issue',current_date,'Staff','[{"item_id":"ct_contrast","quantity":150},{"item_id":"mri_contrast","quantity":30},{"item_id":"gastrolux","quantity":190},{"item_id":"film1714","quantity":200},{"item_id":"cd","quantity":10}]','CT','morning');
select public.save_room_usage_units(current_date,'CT','morning','supplies','{"cd":2}',0,'Staff',0,'{"ct_contrast":{"administered_ml":130,"waste_ml":5},"mri_contrast":{"administered_ml":20.25,"waste_ml":0.5},"gastrolux":{"administered_ml":180,"waste_ml":2.5}}');
select public.save_room_usage_units(current_date,'CT','morning','films','{"film1714":25}',10,'Staff',0,'{}');
insert into public.daily_contrast_data(date,data) values(current_date,'{"test":true}');
insert into public.contrast_usage_logs(volume_ml) values(38);
do $$begin
 if (select balance from public.room_stock where room='CT' and item_id='ct_contrast')<>15 or (select balance from public.room_stock where room='CT' and item_id='mri_contrast')<>9.25 or (select balance from public.room_stock where room='CT' and item_id='gastrolux')<>7.5 or (select balance from public.room_stock where room='CT' and item_id='film1714')<>175 then raise exception 'Base-unit pick or actual-use subtraction incorrect';end if;
 begin perform public.save_room_usage_units(current_date,'CT','afternoon','supplies','{}',0,'Staff',0,'{"ct_contrast":{"administered_ml":100,"waste_ml":0}}');raise exception 'Overdraw accepted';exception when others then if sqlerrm not like 'Not enough recorded%' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.stock_items) or (public.inventory_permissions()->>'has_access')::boolean then raise exception 'Unapproved user can read stock';end if;
 begin perform public.move_room_stock_units('issue',current_date,'Other','[{"item_id":"cd","quantity":1}]','CT','night');raise exception 'Outsider pick accepted';exception when others then if sqlerrm not like 'Your account has not been approved%' then raise;end if;end;
 if exists(select 1 from public.daily_contrast_data) or exists(select 1 from public.contrast_usage_logs) then raise exception 'Outsider clinical read accepted';end if;
 begin insert into public.daily_contrast_data(date,data) values(current_date+1,'{}');raise exception 'Outsider clinical write accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
select set_config('request.jwt.claims','{"is_anonymous":true}',true);
set local role authenticated;
do $$begin if exists(select 1 from public.stock_items) then raise exception 'Anonymous login can read stock';end if;end $$;
reset role;
do $$begin if (select count(*) from radcontrack_private.stock_receipt_audit)<>2 then raise exception 'Correction audit lost';end if;end $$;
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select public.move_room_stock_units('receipt',current_date,'Admin','[{"item_id":"cd","quantity":5}]',null,null,'BEFORE COUNT');
select public.move_room_stock_units('opening',current_date,'Admin','[{"item_id":"cd","quantity":55}]');
do $$declare r public.stock_movements;begin
 select * into r from public.stock_movements where reference='BEFORE COUNT';
 begin perform public.edit_stock_receipt(r.id,r.version,10,current_date,'Admin',null,false);raise exception 'Receipt included in same-day count edited';exception when others then if sqlerrm not like 'This receipt is already covered%' then raise;end if;end;
end $$;
select public.move_room_stock_units('receipt',current_date,'Admin','[{"item_id":"cd","quantity":5}]',null,null,'AFTER COUNT');
select public.move_room_stock_units('issue',current_date,'Admin','[{"item_id":"cd","quantity":60}]','MRI','night');
do $$declare r public.stock_movements;begin
 select * into r from public.stock_movements where reference='AFTER COUNT';
 begin perform public.edit_stock_receipt(r.id,r.version,5,current_date,'Admin',null,true);raise exception 'Consumed receipt deletion accepted';exception when others then if sqlerrm not like 'The stock has already been picked%' then raise;end if;end;
end $$;
reset role;
rollback;
select 'Stock conversion, receipts, staff and outsider permissions passed; test writes rolled back' result;
