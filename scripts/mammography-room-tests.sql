\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select public.move_room_stock_units('issue',current_date,'Honey','[{"item_id":"film1714","quantity":20}]','Mammography','morning','MAMMO TEST');
select public.move_room_stock_units('room_count',current_date,'Honey','[{"item_id":"film1714","quantity":20}]','Mammography',null,null);
select public.save_room_usage_units(current_date,'Mammography','morning','films','{"film1714":5}',1,'Honey',0,'{}');
do $test$begin
 if (select balance from public.room_stock where room='Mammography' and item_id='film1714')<>15 then raise exception 'Mammography film use did not update room balance';end if;
 if (select patients from public.stock_shift_usage where room='Mammography' and category='films')<>1 then raise exception 'Mammography patients missing';end if;
end;$test$;
select public.save_room_usage_units(current_date,'Mammography','morning','films','{"film1714":4}',1,'Honey',1,'{}');
do $test$begin
 if (select balance from public.room_stock where room='Mammography' and item_id='film1714')<>16 then raise exception 'Mammography correction did not restore difference';end if;
 begin perform public.move_room_stock_units('issue',current_date,'Honey','[{"item_id":"cd","quantity":1}]','Invalid room','morning');raise exception 'Invalid room accepted';exception when others then if sqlerrm not like 'Choose the room receiving the stock%' then raise;end if;end;
end;$test$;
rollback;
select 'Mammography picks, counts, usage and corrections work; invalid rooms remain rejected' result;
