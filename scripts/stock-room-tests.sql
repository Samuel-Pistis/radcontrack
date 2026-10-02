\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
select set_config('request.jwt.claims','{"email":"btradiographers@gmail.com"}',true);
set local role authenticated;
-- Collections are saved while the previous store balance is unknown.
select public.move_room_stock('receipt',current_date,'Tope','[{"item_id":"film1714","quantity":2}]');
select public.move_room_stock('receipt',current_date,'Tope','[{"item_id":"cd","quantity":20}]',null,null,null,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select public.move_room_stock('receipt',current_date,'Tope','[{"item_id":"cd","quantity":20}]',null,null,null,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
do $$begin if(select balance from public.stock_items where id='cd')<>20 then raise exception 'Collection retry counted twice';end if;end $$;
do $$begin if (select opening_recorded from public.stock_items where id='film1714') then raise exception 'Unknown store balance presented as known'; end if; end $$;
-- The receipt can be allocated without guessing what was previously there.
select public.move_room_stock('issue',current_date,'Tope','[{"item_id":"film1714","quantity":1}]','CT','morning');
do $$begin if (select balance from public.stock_items where id='film1714')<>1 or (select balance from public.room_stock where room='CT' and item_id='film1714')<>100 then raise exception 'Pack to films transfer failed'; end if; end $$;
select public.save_room_usage(current_date,'CT','morning','films','{"film1714":30}',5,'Tope',0);
-- Same quantities: no second deduction. Correction: only the difference.
select public.save_room_usage(current_date,'CT','morning','films','{"film1714":30}',5,'Tope',1);
select public.save_room_usage(current_date,'CT','morning','films','{"film1714":20}',5,'Tope',2);
do $$begin if (select balance from public.room_stock where room='CT' and item_id='film1714')<>80 or (select balance from public.stock_items where id='film1714')<>1 then raise exception 'Usage deducted twice or touched store'; end if; end $$;
select public.save_room_usage(current_date,'CT','afternoon','films','{"film1714":10}',2,'Jane',0);
do $$begin if (select balance from public.room_stock where room='CT' and item_id='film1714')<>70 then raise exception 'Shift carry forward failed'; end if; end $$;
-- Current count replaces the recorded balance, rather than adding it again.
select public.move_room_stock('opening',current_date,'Jane','[{"item_id":"film1714","quantity":4}]');
select public.move_room_stock('room_count',current_date,'Jane','[{"item_id":"film1714","quantity":70}]','CT');
do $$begin if (select balance from public.stock_items where id='film1714')<>4 then raise exception 'Count was added to receipts'; end if; end $$;
-- Rejected multi-item pick is atomic.
do $$declare before integer; begin select balance into before from public.stock_items where id='cd'; begin perform public.move_room_stock('issue',current_date,'Tope','[{"item_id":"cd","quantity":1},{"item_id":"film1714","quantity":100}]','CT','night'); raise exception 'Expected insufficient stock rejection'; exception when others then if sqlerrm not like 'Not enough recorded %' then raise; end if; end; if (select balance from public.stock_items where id='cd')<>before then raise exception 'Batch partially saved'; end if; if exists(select 1 from public.room_stock where item_id='cd') then raise exception 'Failed batch left room stock'; end if; end $$;
-- Concurrent/stale update protection.
do $$begin begin perform public.save_room_usage(current_date,'CT','afternoon','films','{"film1714":10}',2,'Jane',0); raise exception 'Expected stale version rejection'; exception when others then if sqlerrm not like 'Someone else updated%' then raise; end if; end; end $$;
-- Editing usage already included in a subsequent count must not deduct it again.
do $$begin begin perform public.save_room_usage(current_date,'CT','morning','films','{"film1714":21}',5,'Tope',3); raise exception 'Expected counted usage rejection'; exception when others then if sqlerrm not like 'This earlier usage%' then raise; end if; end; end $$;
-- Known depletion at a room does not allow overspending.
do $$begin begin perform public.save_room_usage(current_date,'CT','night','films','{"film1714":71}',5,'Tope',0); raise exception 'Expected room overspend rejection'; exception when others then if sqlerrm not like 'Not enough recorded stock%' then raise; end if; end; end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"email":"other@example.com"}',true);
do $$begin if exists(select 1 from public.room_stock) then raise exception 'Unauthorized read'; end if; begin perform public.move_room_stock('receipt',current_date,'Other','[{"item_id":"cd","quantity":10}]'); raise exception 'Unauthorized write'; exception when others then if sqlerrm not like 'Sign in with%' then raise; end if; end; end $$;
reset role;
rollback;
select 'All room stock tests passed; test records rolled back' as result;

