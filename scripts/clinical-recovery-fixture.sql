\set ON_ERROR_STOP on
insert into public.daily_contrast_data(date,data) values('2026-10-07', jsonb_build_object(
 'date','2026-10-07',
 'morning','{"hexopack350":{"received":{"mls":1200},"consumption":{"mls":685},"patients":10},"gastrolux":{"received":{"mls":300},"consumption":{"mls":80},"patients":2},"mriContrast":{"received":{"mls":53},"consumption":{"mls":40},"patients":7},"metadata":{"calculatedBy":"Babalola","attestation":false}}'::jsonb,
 'afternoon','{"hexopack350":{"consumption":{"mls":380},"patients":5},"mriContrast":{"consumption":{"mls":9},"patients":0},"metadata":{"calculatedBy":"George","attestation":false}}'::jsonb,
 'night','{}'::jsonb
));
create table recovery_store_before as select id,balance from public.stock_items;
