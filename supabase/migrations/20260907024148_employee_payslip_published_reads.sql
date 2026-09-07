-- Employees can read only their own published payslips. HR retains draft access.
alter policy "Employees can view own payslips" on public.payslips
using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role in ('admin', 'super_admin'))
  or (
    user_id = (select auth.uid()) and published is true
    and exists (select 1 from public.profiles p where p.id = (select auth.uid())
      and p.role = 'employee' and p.is_active is true)
  )
);

alter policy "Employees can download own payslips" on storage.objects
using (
  bucket_id = 'payslips'
  and (
    exists (select 1 from public.profiles p where p.id = (select auth.uid())
      and p.role in ('admin', 'super_admin'))
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and exists (
        select 1 from public.payslips s
        where s.file_path = storage.objects.name
          and s.user_id = (select auth.uid()) and s.published is true
      )
      and exists (select 1 from public.profiles p where p.id = (select auth.uid())
        and p.role = 'employee' and p.is_active is true)
    )
  )
);
