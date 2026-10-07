\set ON_ERROR_STOP on
begin;
insert into radcontrack_private.inventory_members(user_id,role,active) values('22222222-2222-2222-2222-222222222222','staff',true) on conflict(user_id) do update set active=true;
insert into radcontrack_private.stock_correction_audit(source,record_id,before_record,after_record,reason,changed_by,changed_at)
 values('store','AUDIT TEST','{"item_id":"film1714","quantity":10000}','{"item_id":"film1714","quantity":100}','Wrong quantity','44444444-4444-4444-4444-444444444444',clock_timestamp()),
 ('room','OLD AUDIT TEST','{}','{}','Old period','44444444-4444-4444-4444-444444444444',clock_timestamp()-interval '40 days');
insert into radcontrack_private.stock_receipt_audit(receipt_id,before_record,after_record,changed_by,changed_at)
 select id,'{"quantity":10}','{"quantity":5}','44444444-4444-4444-4444-444444444444',clock_timestamp() from public.stock_movements limit 1;
select set_config('request.jwt.claims','{}',true);
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
set local role authenticated;
do $test$
declare r jsonb;limited jsonb;
begin
 r:=public.stock_audit_history((now() at time zone 'Africa/Lagos')::date,(now() at time zone 'Africa/Lagos')::date,0,50);
 if not exists(select 1 from jsonb_array_elements(r) e where e->>'record_id'='AUDIT TEST' and e->>'changed_by'='honey.onabanjo@bthdc.com.ng') then raise exception 'Editor cannot see actor-labelled history';end if;
 if exists(select 1 from jsonb_array_elements(r) e where e->>'record_id'='OLD AUDIT TEST') then raise exception 'Audit dates not filtered';end if;
 if not exists(select 1 from jsonb_array_elements(r) e where e->>'reason'='Receipt correction (earlier version)') then raise exception 'Older receipt audit omitted';end if;
 limited:=public.stock_audit_history((now() at time zone 'Africa/Lagos')::date,(now() at time zone 'Africa/Lagos')::date,0,1);
 if jsonb_array_length(limited)<>1 then raise exception 'Audit page size not enforced';end if;
 if public.stock_audit_history((now() at time zone 'Africa/Lagos')::date,(now() at time zone 'Africa/Lagos')::date,1,1)->0->>'id'=limited->0->>'id' then raise exception 'Audit pagination repeats first record';end if;
 begin perform public.stock_audit_history(current_date,current_date,0,201);raise exception 'Oversized page accepted';exception when others then if sqlerrm not like 'Choose a valid audit period%' then raise;end if;end;
end;
$test$;
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
set local role authenticated;
select jsonb_array_length(public.stock_audit_history(current_date,current_date)) as administrator_audit_records;
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
set local role authenticated;
do $test$begin
 begin perform public.stock_audit_history(current_date,current_date);raise exception 'Staff can read private audit history';exception when others then if sqlerrm not like 'Only authorised stock editors and administrators%' then raise;end if;end;
end;$test$;
reset role;
do $test$begin
 if has_function_privilege('anon','public.stock_audit_history(date,date,integer,integer)','execute') or
  has_table_privilege('authenticated','radcontrack_private.stock_correction_audit','select') or
  has_table_privilege('authenticated','radcontrack_private.stock_receipt_audit','select') then raise exception 'Private audit records are directly accessible';end if;
end;$test$;
rollback;
select 'Audit history is authorised, paginated, date-filtered, actor-labelled and includes older receipt edits' result;
