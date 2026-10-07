-- Honey can manage stock; only the original administrator can manage staff access.
begin;
alter table radcontrack_private.inventory_members drop constraint inventory_members_role_check;
alter table radcontrack_private.inventory_members add constraint inventory_members_role_check check(role in ('manager','staff','stock_editor'));
create or replace function radcontrack_private.assert_stock_manager() returns void language plpgsql security invoker set search_path='' as $$
begin if coalesce(radcontrack_private.inventory_role(),'') not in ('manager','stock_editor') then raise exception 'Only authorised stock editors can manage received stock';end if;end $$;
create or replace function public.inventory_permissions() returns jsonb language sql security invoker set search_path='' as $$
select jsonb_build_object('has_access',radcontrack_private.inventory_role() is not null,'can_manage_stock',coalesce(radcontrack_private.inventory_role(),'') in ('manager','stock_editor'),'can_manage_staff',radcontrack_private.inventory_role()='manager')$$;
create or replace function radcontrack_private.set_stock_staff(p_email text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid;begin
 if radcontrack_private.inventory_role() is distinct from 'manager' then raise exception 'Only the administrator can manage staff access';end if;
 select id into v_id from auth.users where lower(email)=lower(btrim(p_email)) and email_confirmed_at is not null;
 if v_id is null then raise exception 'Ask this staff member to register and confirm their email first';end if;
 if exists(select 1 from radcontrack_private.inventory_members where user_id=v_id and role='manager') then raise exception 'The administrator account cannot be changed here';end if;
 if p_active is null then raise exception 'Choose whether to allow access';end if;
 insert into radcontrack_private.inventory_members(user_id,role,active) values(v_id,'staff',p_active) on conflict(user_id) do update set active=excluded.active;
end $$;
-- Cancel the whole migration if the verified login does not yet exist.
do $$declare v_id uuid;begin
 select id into v_id from auth.users where lower(email)='honey.onabanjo@bthdc.com.ng' and email_confirmed_at is not null;
 if v_id is null then raise exception 'Honey must create and confirm the honey.onabanjo@bthdc.com.ng login first. No access changes were applied';end if;
 insert into radcontrack_private.inventory_members(user_id,role,active) values(v_id,'stock_editor',true) on conflict(user_id) do update set role='stock_editor',active=true;
end $$;
commit;
