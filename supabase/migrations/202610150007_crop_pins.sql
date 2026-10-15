create or replace function public.delete_asset(p_owner uuid,p_asset uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from assets where id=p_asset and owner_id=p_owner for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if exists(select 1 from asset_references where asset_id=p_asset) or exists(select 1 from questions where body->>'imageId'=p_asset::text) or exists(select 1 from jobs where status in ('queued','running') and ((payload->'assetIds') ? p_asset::text or payload->>'sourceAssetId'=p_asset::text)) then raise exception 'ASSET_IN_USE'; end if;
 update assets set status='deleted' where id=p_asset;
end $$;
