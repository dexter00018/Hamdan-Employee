-- Run AFTER the migration in a transaction. All synthetic metadata is rolled back.
-- No PDF bytes are uploaded and no emails/webhooks are sent by this check.
begin;
create temporary table ask_ai_fixtures (user_id uuid, slip_id uuid, file_path text, published boolean);
insert into ask_ai_fixtures
select p.id, gen_random_uuid(), p.id::text || '/__ask_ai_rls_test__/' || gen_random_uuid()::text || '.pdf', v.published
from (select id from public.profiles where role = 'employee' and is_active is true order by id limit 2) p
cross join (values (true), (false)) v(published);
do $$ begin
  if (select count(distinct user_id) from ask_ai_fixtures) < 2 then
    raise exception 'Need two active employees for the isolated RLS check';
  end if;
end $$;
insert into public.payslips(id, user_id, cutoff_period, cutoff_label, file_path, file_name, published)
select slip_id, user_id, '2026-08:H2', 'Synthetic RLS test', file_path, 'synthetic.pdf', published from ask_ai_fixtures;
insert into storage.objects(bucket_id, name)
select 'payslips', file_path from ask_ai_fixtures;
grant select on ask_ai_fixtures to authenticated;
do $$
declare employee record; admin_id uuid; table_count integer; file_count integer;
begin
  for employee in select distinct user_id from ask_ai_fixtures loop
    perform set_config('request.jwt.claims', json_build_object('sub', employee.user_id, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into table_count from public.payslips where id in (select slip_id from ask_ai_fixtures);
    select count(*) into file_count from storage.objects where bucket_id = 'payslips' and name in (select file_path from ask_ai_fixtures);
    if table_count <> 1 or file_count <> 1 then
      raise exception 'Employee can see colleague/draft records or cannot see own published record: table %, storage %', table_count, file_count;
    end if;
    if exists(select 1 from public.payslips where id in (select slip_id from ask_ai_fixtures) and (user_id <> auth.uid() or published is not true)) then
      raise exception 'Unexpected payslip owner or publication access';
    end if;
    execute 'reset role';
  end loop;
  select id into admin_id from public.profiles where role in ('admin', 'super_admin') order by id limit 1;
  if admin_id is null then raise exception 'Need an admin for the draft-access regression check'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into table_count from public.payslips where id in (select slip_id from ask_ai_fixtures);
  select count(*) into file_count from storage.objects where bucket_id = 'payslips' and name in (select file_path from ask_ai_fixtures);
  if table_count <> 4 or file_count <> 4 then raise exception 'HR lost draft or published access'; end if;
  execute 'reset role';
end $$;
rollback;
