create function public.finish_upload(p_job uuid,p_lease uuid,p_path text,p_thumb text,p_bytes bigint,p_width integer,p_height integer) returns void language plpgsql security definer set search_path=public as $$
declare job jobs; account profiles; asset uuid;
begin
 select * into job from jobs where id=p_job and status='running' and lease_token=p_lease for update;
 if not found then raise exception 'LEASE_LOST'; end if;
 select * into account from profiles where id=job.owner_id for update;
 if account.status<>'active' then raise exception 'ACCOUNT_INACTIVE'; end if;
 asset=(job.payload->>'assetId')::uuid;
 if coalesce((select sum(bytes) from assets where owner_id=job.owner_id and status in ('pending','processing','ready') and id<>asset),0)+p_bytes>account.storage_limit then raise exception 'STORAGE_QUOTA'; end if;
 update assets set status='ready',path=p_path,thumbnail_path=p_thumb,mime='image/webp',bytes=p_bytes,width=p_width,height=p_height where id=asset and owner_id=job.owner_id;
 update jobs set status='completed',result=jsonb_build_object('assetId',asset),lease_until=null,updated_at=now() where id=p_job;
end $$;
create function public.delete_asset(p_owner uuid,p_asset uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from assets where id=p_asset and owner_id=p_owner for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if exists(select 1 from asset_references where asset_id=p_asset) then raise exception 'ASSET_IN_USE'; end if;
 update assets set status='deleted' where id=p_asset;
end $$;
create function public.immutable_template() returns trigger language plpgsql as $$
begin
 if old.released then raise exception 'RELEASED_VERSION_IMMUTABLE'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger template_version_immutable before update or delete on public.template_versions for each row execute function public.immutable_template();
revoke execute on function public.finish_upload(uuid,uuid,text,text,bigint,integer,integer),public.delete_asset(uuid,uuid),public.immutable_template() from public,anon,authenticated;
grant execute on function public.finish_upload(uuid,uuid,text,text,bigint,integer,integer),public.delete_asset(uuid,uuid) to service_role;
