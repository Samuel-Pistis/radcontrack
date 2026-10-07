\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
do $$begin
 if (public.inventory_permissions()->>'can_manage_stock')::boolean is not true or (public.inventory_permissions()->>'can_manage_staff')::boolean is not false then raise exception 'Stock editor permissions incorrect';end if;
 begin perform public.set_stock_staff('outsider@example.com',true);raise exception 'Stock editor can approve staff';exception when others then if sqlerrm not like 'Only the administrator can manage staff access%' then raise;end if;end;
end $$;
select public.move_room_stock_units('receipt',current_date,'Honey','[{"item_id":"cd","quantity":20}]',null,null,'HONEY TEST');
do $$declare r public.stock_movements;begin
 select * into r from public.stock_movements where reference='HONEY TEST';
 perform public.edit_stock_receipt(r.id,r.version,25,current_date,'Honey',null,false);
 if (select balance from public.stock_items where id='cd')<>75 then raise exception 'Stock editor correction failed';end if;
 perform public.edit_stock_receipt(r.id,r.version+1,25,current_date,'Honey',null,true);
 if (select balance from public.stock_items where id='cd')<>50 then raise exception 'Stock editor deletion failed';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
set local role authenticated;
do $$begin if (public.inventory_permissions()->>'can_manage_staff')::boolean is not true then raise exception 'Administrator access lost';end if;end $$;
select public.set_stock_staff('honey.onabanjo@bthdc.com.ng',false);
reset role;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.stock_items) then raise exception 'Disabled stock editor can read stock';end if;
 begin perform public.move_room_stock_units('receipt',current_date,'Honey','[{"item_id":"cd","quantity":1}]');raise exception 'Disabled editor can receive stock';exception when others then if sqlerrm not like 'Your account has not been approved%' then raise;end if;end;
end $$;
rollback;
select 'Honey can add, edit and delete stock; cannot approve staff; access can be revoked' result;
