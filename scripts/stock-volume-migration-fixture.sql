-- Run before the volume migration in a disposable test database.
insert into public.room_stock(room,item_id,balance) values('Fluoroscopy','ct_contrast',2);
insert into public.stock_shift_usage(date,room,shift,category,quantities,version,recorded_by_name) values(current_date,'Fluoroscopy','night','supplies','{"ct_contrast":1}',1,'Test staff');
insert into public.room_stock_movements(batch_id,room,item_id,movement_type,change,balance_after,occurred_on,staff_name,recorded_by,balance_known) values(gen_random_uuid(),'Fluoroscopy','ct_contrast','usage',-1,2,current_date,'Test staff','11111111-1111-1111-1111-111111111111',false);

