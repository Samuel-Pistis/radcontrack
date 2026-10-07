\set ON_ERROR_STOP on
begin;
insert into radcontrack_private.inventory_members(user_id,role,active) values('22222222-2222-2222-2222-222222222222','staff',true)
 on conflict(user_id) do update set active=true;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select public.move_room_stock_units('opening',current_date,'Honey','[{"item_id":"film1714","quantity":60000}]',null,null,'COUNT TEST');
select public.move_room_stock_units('issue',current_date,'George','[{"item_id":"film1714","quantity":10000}]','CT','afternoon','PICK TEST');
do $test$
declare r public.stock_movements;
begin
 select * into r from public.stock_movements where reference='PICK TEST';
 perform public.correct_stock_movement('store',r.id,r.version,100,current_date,'George','PICK TEST','Entered films incorrectly',false);
 if (select balance from public.stock_items where id='film1714')<>59900 or
  (select balance from public.room_stock where room='CT' and item_id='film1714')<>100 then raise exception 'Pick correction does not conserve stock';end if;
 begin perform public.correct_stock_movement('store',r.id,r.version,200,current_date,'George',null,'Stale version',false);
  raise exception 'Stale correction accepted';exception when others then if sqlerrm not like 'This stock entry changed%' then raise;end if;end;
 select * into r from public.stock_movements where reference='COUNT TEST';
 perform public.correct_stock_movement('store',r.id,r.version,1000,current_date,'Honey','COUNT TEST','Wrong count quantity',false);
 if (select balance from public.stock_items where id='film1714')<>900 then raise exception 'Count correction ignores later picks';end if;
 begin perform public.correct_stock_movement('store',r.id,r.version+1,0,current_date,'Honey',null,'Delete baseline',true);
  raise exception 'Deleted physical count';exception when others then if sqlerrm not like 'Correct the count instead%' then raise;end if;end;
 begin perform public.correct_stock_movement('store',r.id,r.version+1,50,current_date,'Honey',null,'Count too low',false);
  raise exception 'Negative count balance accepted';exception when others then if sqlerrm not like 'The correction would make store stock negative%' then raise;end if;end;
end;
$test$;
select public.save_room_usage_units(current_date,'CT','afternoon','films','{"film1714":80}',20,'George',0,'{}');
do $test$
declare r public.stock_movements;
begin
 select * into r from public.stock_movements where reference='PICK TEST';
 begin perform public.correct_stock_movement('store',r.id,r.version,10,current_date,'George',null,'Too small pick',false);
  raise exception 'Removed consumed stock';exception when others then if sqlerrm not like 'This stock has already been used%' then raise;end if;end;
end;
$test$;
select public.save_room_usage_units(current_date,'CT','afternoon','films','{"film1714":0}',0,'George',1,'{}');
do $test$
declare r public.stock_movements;
begin
 select * into r from public.stock_movements where reference='PICK TEST';
 perform public.correct_stock_movement('store',r.id,r.version,100,current_date,'George',null,'Remove accidental pick',true);
 if (select balance from public.stock_items where id='film1714')<>1000 or
  (select balance from public.room_stock where room='CT' and item_id='film1714')<>0 then raise exception 'Pick deletion does not reverse both balances';end if;
end;
$test$;
select public.move_room_stock_units('room_count',current_date,'Honey','[{"item_id":"cd","quantity":40}]','MRI',null,null);
select public.save_room_usage_units(current_date,'MRI','morning','supplies','{"cd":5}',0,'Honey',0,'{}');
do $test$
declare r public.room_stock_movements;
begin
 select * into r from public.room_stock_movements where room='MRI' and item_id='cd' and movement_type='count' order by created_at desc limit 1;
 perform public.correct_stock_movement('room',r.id,r.version,30,current_date,'Honey',null,'Count correction',false);
 if (select balance from public.room_stock where room='MRI' and item_id='cd')<>25 then raise exception 'Room count ignores later use';end if;
end;
$test$;
-- A later count must prevent a stale movement from changing today's balance.
select public.move_room_stock_units('receipt',current_date,'Honey','[{"item_id":"cd","quantity":10}]',null,null,'OLD RECEIPT');
select public.move_room_stock_units('opening',current_date,'Honey','[{"item_id":"cd","quantity":100}]',null,null,'LATEST COUNT');
do $test$
declare r public.stock_movements;
begin
 select * into r from public.stock_movements where reference='OLD RECEIPT';
 begin perform public.correct_stock_movement('store',r.id,r.version,20,current_date,'Honey',null,'Covered receipt',false);
  raise exception 'Changed a covered receipt';exception when others then if sqlerrm not like 'A later store count includes%' then raise;end if;end;
end;
$test$;
reset role;
do $test$begin
 if not exists(select 1 from radcontrack_private.stock_correction_audit where source='usage') or
  not exists(select 1 from radcontrack_private.stock_correction_audit where source='store') or
  not exists(select 1 from radcontrack_private.stock_correction_audit where source='room') then raise exception 'Correction audit missing';end if;
end;$test$;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
set local role authenticated;
do $test$
declare r public.stock_movements;
begin
 select * into r from public.stock_movements where reference='LATEST COUNT';
 begin perform public.correct_stock_movement('store',r.id,r.version,200,current_date,'Shared login',null,'Forbidden count',false);
  raise exception 'Shared account edited store count';exception when others then if sqlerrm not like 'Only authorised stock editors%' then raise;end if;end;
 select * into r from public.stock_movements where reference='OLD RECEIPT';
 begin perform public.correct_stock_movement('store',r.id,r.version,20,current_date,'Shared login',null,'Forbidden receipt',false);
  raise exception 'Shared account edited receipt';exception when others then if sqlerrm not like 'Only authorised stock editors%' then raise;end if;end;
end;
$test$;
select public.move_room_stock_units('issue',current_date,'Shared login','[{"item_id":"cd","quantity":10}]','X-ray','night','OWN PICK');
do $test$
declare r public.stock_movements;
begin
 select * into r from public.stock_movements where reference='OWN PICK';
 perform public.correct_stock_movement('store',r.id,r.version,8,current_date,'Shared login','OWN PICK','Own pick correction',false);
end;
$test$;
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
set local role authenticated;
do $test$
declare r public.stock_movements;
begin
 select * into r from public.stock_movements where reference='OWN PICK';
 begin perform public.correct_stock_movement('store',r.id,r.version,5,current_date,'Other staff',null,'Other staff pick',false);
  raise exception 'Edited someone else pick';exception when others then if sqlerrm not like 'You may only correct your own%' then raise;end if;end;
end;
$test$;
rollback;
select 'Stock corrections conserve balances, protect counts/roles/versions, and preserve audit history' result;
