create function public.storage_usage(p_owner uuid) returns bigint language sql stable security definer set search_path=public as $$
 select coalesce((select sum(bytes) from assets where owner_id=p_owner),0)+coalesce((select sum(case when status='completed' then coalesce((result->>'bytes')::bigint,0) when status in ('queued','running') then 52428800 else 0 end) from jobs where owner_id=p_owner and kind='export'),0)
$$;
revoke execute on function public.storage_usage(uuid) from public,anon,authenticated;
grant execute on function public.storage_usage(uuid) to service_role;
create or replace function public.save_game(p_owner uuid,p_spec jsonb,p_revision integer,p_assets uuid[]) returns public.games language plpgsql security definer set search_path=public as $$
declare saved games; current_row games;
begin
 if not exists(select 1 from profiles where id=p_owner and status='active') then raise exception 'ACCOUNT_INACTIVE'; end if;
 if p_spec->>'kind' is distinct from p_spec#>>'{template,type}' then raise exception 'TEMPLATE_MISMATCH'; end if;
 if not exists(select 1 from template_versions where template_type=p_spec#>>'{template,type}' and version=(p_spec#>>'{template,version}')::int) then raise exception 'UNKNOWN_TEMPLATE'; end if;
 perform 1 from assets where id=any(p_assets) for share;
 if exists(select 1 from unnest(p_assets) a where not exists(select 1 from assets where id=a and status='ready' and ((owner_id=p_owner) or (owner_id is null and approved)))) then raise exception 'ASSET_FORBIDDEN'; end if;
 select * into current_row from games where id=(p_spec->>'id')::uuid for update;
 if found then
  if current_row.owner_id<>p_owner then raise exception 'FORBIDDEN'; end if;
  if current_row.revision<>p_revision then raise exception 'REVISION_CONFLICT'; end if;
  if current_row.spec#>>'{template,type}'<>p_spec#>>'{template,type}' then raise exception 'COPY_REQUIRED'; end if;
  update games set spec=p_spec,revision=revision+1,updated_at=now(),status='draft' where id=current_row.id returning * into saved;
  update share_links set revoked_at=now() where game_id=saved.id and revoked_at is null;
 else
  if p_revision<>0 then raise exception 'REVISION_CONFLICT'; end if;
  insert into games(id,owner_id,spec) values((p_spec->>'id')::uuid,p_owner,p_spec) returning * into saved;
 end if;
 delete from asset_references where game_id=saved.id;
 insert into asset_references select saved.id,a from unnest(p_assets) a on conflict do nothing;
 return saved;
end $$;

create function public.finish_export(p_job uuid,p_lease uuid,p_path text,p_bytes bigint) returns void language plpgsql security definer set search_path=public as $$
declare job jobs; account profiles;
begin
 select * into job from jobs where id=p_job and status='running' and lease_token=p_lease for update;
 if not found then raise exception 'LEASE_LOST'; end if;
 select * into account from profiles where id=job.owner_id for update;
 if account.status<>'active' then raise exception 'ACCOUNT_INACTIVE'; end if;
 if p_bytes>52428800 or storage_usage(job.owner_id)-52428800+p_bytes>account.storage_limit then raise exception 'STORAGE_QUOTA'; end if;
 update jobs set status='completed',result=jsonb_build_object('path',p_path,'bytes',p_bytes),lease_until=null,updated_at=now() where id=p_job;
end $$;
revoke execute on function public.finish_export(uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.finish_export(uuid,uuid,text,bigint) to service_role;

create or replace function public.finish_upload(p_job uuid,p_lease uuid,p_path text,p_thumb text,p_bytes bigint,p_width integer,p_height integer) returns void language plpgsql security definer set search_path=public as $$
declare job jobs; account profiles; asset uuid; old_bytes bigint;
begin
 select * into job from jobs where id=p_job and status='running' and lease_token=p_lease for update;
 if not found then raise exception 'LEASE_LOST'; end if;
 select * into account from profiles where id=job.owner_id for update;
 if account.status<>'active' then raise exception 'ACCOUNT_INACTIVE'; end if;
 asset=(job.payload->>'assetId')::uuid;
 select bytes into old_bytes from assets where id=asset;
 if storage_usage(job.owner_id)-old_bytes+p_bytes>account.storage_limit then raise exception 'STORAGE_QUOTA'; end if;
 update assets set status='ready',path=p_path,thumbnail_path=p_thumb,mime='image/webp',bytes=p_bytes,width=p_width,height=p_height where id=asset and owner_id=job.owner_id;
 update jobs set status='completed',result=jsonb_build_object('assetId',asset),lease_until=null,updated_at=now() where id=p_job;
end $$;

create or replace function public.delete_asset(p_owner uuid,p_asset uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from assets where id=p_asset and owner_id=p_owner for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if exists(select 1 from asset_references where asset_id=p_asset) or exists(select 1 from questions where body->>'imageId'=p_asset::text) or exists(select 1 from jobs where kind='export' and status in ('queued','running') and payload->'assetIds' ? p_asset::text) then raise exception 'ASSET_IN_USE'; end if;
 update assets set status='deleted' where id=p_asset;
end $$;

create or replace function public.reserve_job(p_owner uuid,p_kind text,p_key text,p_payload jsonb,p_bytes bigint default 0) returns public.jobs language plpgsql security definer set search_path=public as $$
declare account profiles; existing jobs; reserved jobs;
begin
 select * into account from profiles where id=p_owner and status='active' for update;
 if not found then raise exception 'ACCOUNT_INACTIVE'; end if;
 select * into existing from jobs where owner_id=p_owner and kind=p_kind and idempotency_key=p_key;
 if found then return existing; end if;
 if p_kind='upload' then
  if p_bytes<=0 or p_bytes>5242880 then raise exception 'FILE_SIZE'; end if;
  if (select count(*) from jobs where owner_id=p_owner and kind='upload' and status in ('queued','running'))>=account.upload_limit then raise exception 'UPLOAD_CONCURRENCY'; end if;
  if public.storage_usage(p_owner)+p_bytes>account.storage_limit then raise exception 'STORAGE_QUOTA'; end if;
  insert into assets(id,owner_id,name,bytes,path) values((p_payload->>'assetId')::uuid,p_owner,left(p_payload->>'name',180),p_bytes,p_payload->>'path');
 elsif p_kind='export' then
  perform 1 from assets where id in (select value::uuid from jsonb_array_elements_text(p_payload->'assetIds')) for share;
  if exists(select 1 from jsonb_array_elements_text(p_payload->'assetIds') a where not exists(select 1 from assets where id=a::uuid and status='ready' and (owner_id=p_owner or (owner_id is null and approved)))) then raise exception 'ASSET_FORBIDDEN'; end if;
  if public.storage_usage(p_owner)+52428800>account.storage_limit then raise exception 'STORAGE_QUOTA'; end if;
  if (select count(*) from jobs where owner_id=p_owner and kind='export' and status in ('queued','running'))>=account.concurrent_export_limit then raise exception 'EXPORT_CONCURRENCY'; end if;
  if (select count(*) from jobs where owner_id=p_owner and kind='export' and created_at>=date_trunc('day',now()))>=account.daily_export_limit then raise exception 'EXPORT_DAILY_QUOTA'; end if;
 else raise exception 'UNKNOWN_JOB'; end if;
 insert into jobs(owner_id,kind,idempotency_key,payload) values(p_owner,p_kind,p_key,p_payload) returning * into reserved;
 return reserved;
end $$;

