begin;
do $check$begin
 if to_regclass('radcontrack_private.stock_correction_audit') is null then
  raise exception 'Apply the stock movement corrections SQL from PR #10 before the audit-history update';
 end if;
end;$check$;
create function radcontrack_private.stock_audit_history(p_start date,p_end date,p_offset integer,p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_result jsonb;
begin
 perform radcontrack_private.assert_stock_user();
 if radcontrack_private.inventory_role() not in ('manager','stock_editor') then
  raise exception 'Only authorised stock editors and administrators can view audit history';
 end if;
 if p_start is null or p_end is null or p_start>p_end or p_offset is null or p_offset<0
  or p_limit is null or p_limit not between 1 and 200 then raise exception 'Choose a valid audit period';end if;
 select coalesce(jsonb_agg(to_jsonb(entries)),'[]'::jsonb) into v_result from (
  select a.id,a.source,a.record_id,a.before_record,a.after_record,a.reason,
   coalesce(u.email,a.changed_by::text) as changed_by,a.changed_at
  from (
   select 'correction/'||id::text as id,source,record_id,before_record,after_record,reason,changed_by,changed_at
    from radcontrack_private.stock_correction_audit
   union all
   select 'receipt/'||id::text,'store',receipt_id::text,before_record,after_record,'Receipt correction (earlier version)',changed_by,changed_at
    from radcontrack_private.stock_receipt_audit
  ) a left join auth.users u on u.id=a.changed_by
  where a.changed_at >= (p_start::timestamp at time zone 'Africa/Lagos')
   and a.changed_at < ((p_end+1)::timestamp at time zone 'Africa/Lagos')
  order by a.changed_at desc,a.id desc offset p_offset limit p_limit
 ) entries;
 return v_result;
end;
$function$;
create function public.stock_audit_history(p_start date,p_end date,p_offset integer default 0,p_limit integer default 50)
returns jsonb language sql security invoker set search_path='' as $function$
 select radcontrack_private.stock_audit_history(p_start,p_end,p_offset,p_limit);
$function$;
revoke all on function radcontrack_private.stock_audit_history(date,date,integer,integer),public.stock_audit_history(date,date,integer,integer) from public,anon;
grant execute on function radcontrack_private.stock_audit_history(date,date,integer,integer),public.stock_audit_history(date,date,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
