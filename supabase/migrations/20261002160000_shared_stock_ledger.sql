-- Shared Radiology stock ledger. Requests and approvals are deliberately not receipts.
-- Supabase's automatic RLS event trigger needs no client-callable privileges.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
create table public.stock_items (
  id text primary key,
  name text not null,
  unit text not null,
  balance integer not null default 0 check (balance >= 0),
  opening_recorded boolean not null default false,
  active boolean not null default true
);

insert into public.stock_items (id, name, unit) values
  ('ct_contrast', 'CT Contrast (100 ml)', 'bottles'),
  ('mri_contrast', 'MRI Contrast (15 ml)', 'bottles'),
  ('gastrolux', 'Gastrolux', 'bottles'),
  ('film1714', '17 × 14 film', 'packs'),
  ('film1210', '12 × 10 film', 'packs'),
  ('single_connector', 'Single connector', 'pieces'),
  ('double_connector', 'Double connector', 'pieces'),
  ('cd', 'CD plates', 'pieces'),
  ('cd_jacket', 'CD sleeves', 'pieces'),
  ('gloves_pack', 'Gloves', 'packs'),
  ('gloves_piece', 'Gloves', 'pieces'),
  ('wipes', 'Wipes', 'pieces'),
  ('electrodes', 'Electrodes', 'packs'),
  ('injector_syringe', 'Injector syringe', 'pieces'),
  ('marker', 'Marker', 'pieces'),
  ('pen', 'Pen', 'pieces'),
  ('a4_paper', 'A4 paper', 'reams');

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  item_id text not null references public.stock_items(id),
  movement_type text not null check (movement_type in ('opening', 'receipt', 'issue')),
  quantity integer not null check (quantity >= 0 and (quantity > 0 or movement_type = 'opening')),
  balance_after integer not null check (balance_after >= 0),
  occurred_on date not null,
  recipient_name text not null check (length(btrim(recipient_name)) > 0),
  destination text,
  reference text,
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index stock_movements_item_date_idx on public.stock_movements (item_id, occurred_on);
create index stock_movements_batch_idx on public.stock_movements (batch_id);

alter table public.stock_items enable row level security;
alter table public.stock_movements enable row level security;
revoke all on public.stock_items, public.stock_movements from public, anon, authenticated;
grant select on public.stock_items, public.stock_movements to authenticated;
create policy "Radiology can read stock items" on public.stock_items for select to authenticated
  using (lower(auth.jwt() ->> 'email') = 'btradiographers@gmail.com');
create policy "Radiology can read stock movements" on public.stock_movements for select to authenticated
  using (lower(auth.jwt() ->> 'email') = 'btradiographers@gmail.com');

-- The function locks each item before checking balance and writing the whole batch.
-- Direct table writes are denied, so all staff use the same validation path.
create schema if not exists radcontrack_private;
revoke all on schema radcontrack_private from public, anon;
grant usage on schema radcontrack_private to authenticated;

create function radcontrack_private.record_stock_batch(
  p_type text,
  p_date date,
  p_recipient text,
  p_lines jsonb,
  p_destination text default null,
  p_reference text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_batch uuid := gen_random_uuid();
  v_line jsonb;
  v_item text;
  v_quantity integer;
  v_balance bigint;
  v_opening_recorded boolean;
  v_after bigint;
begin
  if v_user is null or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true'
     or lower(auth.jwt() ->> 'email') is distinct from 'btradiographers@gmail.com' then
    raise exception 'Sign in with the radiology account before recording stock';
  end if;
  if p_type is null or p_type not in ('opening', 'receipt', 'issue') or p_date is null
     or length(btrim(coalesce(p_recipient, ''))) < 2
     or jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'Complete the stock movement details';
  end if;
  if jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 50 then
    raise exception 'Complete the stock movement details';
  end if;
  if p_type = 'issue' and length(btrim(coalesce(p_destination, ''))) = 0 then
    raise exception 'Enter the room or shift receiving the daily pick';
  end if;
  if (select count(distinct value ->> 'item_id') from jsonb_array_elements(p_lines))
     <> jsonb_array_length(p_lines) then
    raise exception 'List each item only once per entry';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines) order by value ->> 'item_id' loop
    v_item := v_line ->> 'item_id';
    if jsonb_typeof(v_line) is distinct from 'object'
       or jsonb_typeof(v_line -> 'quantity') is distinct from 'number'
       or (v_line ->> 'quantity') !~ '^[0-9]+$' then
      raise exception 'Quantities must be positive whole numbers';
    end if;
    v_quantity := (v_line ->> 'quantity')::integer;
    if v_quantity is null or v_quantity < 0 or v_quantity > 1000000 or (p_type <> 'opening' and v_quantity = 0) then
      raise exception 'Enter whole quantities; only an opening count can be zero';
    end if;
    select balance, opening_recorded into v_balance, v_opening_recorded from public.stock_items where id = v_item and active for update;
    if not found then raise exception 'Unknown stock item: %', v_item; end if;
    if p_type <> 'opening' and not v_opening_recorded then
      raise exception 'Record the opening physical count for % first', v_item;
    end if;

    if p_type = 'opening' and exists (
      select 1 from public.stock_movements where item_id = v_item
    ) then
      raise exception 'Opening stock already set for %', v_item;
    end if;
    if p_type = 'issue' and v_balance < v_quantity then
      raise exception 'Only % units available for %', v_balance, v_item;
    end if;
    v_after := v_balance + case when p_type = 'issue' then -v_quantity else v_quantity end;

    insert into public.stock_movements
      (batch_id, item_id, movement_type, quantity, balance_after, occurred_on, recipient_name,
       destination, reference, recorded_by)
    values
      (v_batch, v_item, p_type, v_quantity, v_after, p_date, btrim(p_recipient),
       nullif(btrim(coalesce(p_destination, '')), ''),
       nullif(btrim(coalesce(p_reference, '')), ''), v_user);
    update public.stock_items
      set balance = v_after, opening_recorded = true
      where id = v_item;
  end loop;
  return v_batch;
end;
$$;

revoke all on function radcontrack_private.record_stock_batch(text, date, text, jsonb, text, text) from public, anon;
grant execute on function radcontrack_private.record_stock_batch(text, date, text, jsonb, text, text) to authenticated;

create function public.record_stock_batch(
  p_type text, p_date date, p_recipient text, p_lines jsonb,
  p_destination text default null, p_reference text default null
) returns uuid language sql security invoker set search_path = ''
as $$
  select radcontrack_private.record_stock_batch(p_type, p_date, p_recipient, p_lines, p_destination, p_reference);
$$;
revoke all on function public.record_stock_batch(text, date, text, jsonb, text, text) from public, anon;
grant execute on function public.record_stock_batch(text, date, text, jsonb, text, text) to authenticated;
