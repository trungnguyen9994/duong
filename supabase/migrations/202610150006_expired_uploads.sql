create or replace function public.claim_job() returns public.jobs language plpgsql security definer set search_path=public as $$
declare claimed jobs;
begin
 update jobs set status='failed',error='Đã hết số lần thử.',updated_at=now() where status='running' and lease_until<now() and attempts>=3;
 update jobs set status='failed',error='Upload quá hạn.',updated_at=now() where kind='upload' and status='queued' and coalesce((payload->>'ready')::boolean,false)=false and created_at<now()-interval '1 hour';
 -- Keep reserved bytes until Storage cleanup succeeds; an expired signed upload may have left a file.
 update assets set status='failed' where status in ('pending','processing') and id in (select (payload->>'assetId')::uuid from jobs where kind='upload' and status='failed');
 select * into claimed from jobs where (status='queued' or (status='running' and lease_until<now())) and attempts<3 and (kind='export' or payload->>'ready'='true') order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 update jobs set status='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now() where id=claimed.id returning * into claimed;
 return claimed;
end $$;
