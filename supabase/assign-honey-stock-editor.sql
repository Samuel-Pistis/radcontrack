-- Run in the SQL Editor after the stock-editor migration and Honey's signup.
begin;
do $$declare v_id uuid;begin
 select id into v_id from auth.users where lower(email)='honey.onabanjo@bthdc.com.ng' and email_confirmed_at is not null;
 if v_id is null then raise exception 'Honey must create and confirm the honey.onabanjo@bthdc.com.ng login first. No access changes were applied';end if;
 insert into radcontrack_private.inventory_members(user_id,role,active) values(v_id,'stock_editor',true) on conflict(user_id) do update set role='stock_editor',active=true;
end $$;
commit;
