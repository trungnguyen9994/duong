create function public.submit_game(p_owner uuid,p_id uuid,p_revision integer) returns public.games language plpgsql security definer set search_path=public as $$
declare saved games;
begin
 update games set status='pending',revision=revision+1,updated_at=now() where id=p_id and owner_id=p_owner and revision=p_revision returning * into saved;
 if not found then raise exception 'REVISION_CONFLICT'; end if;
 insert into audit_log(actor_id,action,target_id) values(p_owner,'submit_game',p_id::text);
 return saved;
end $$;
create function public.moderate_game(p_actor uuid,p_id uuid,p_revision integer,p_approve boolean) returns uuid language plpgsql security definer set search_path=public as $$
declare game games; token uuid;
begin
 if not exists(select 1 from profiles where id=p_actor and status='active' and (role='super_admin' or (role='admin' and 'moderation'=any(permissions)))) then raise exception 'FORBIDDEN'; end if;
 select * into game from games where id=p_id and revision=p_revision and status='pending' for update;
 if not found then raise exception 'REVISION_CONFLICT'; end if;
 if p_approve and exists(select 1 from asset_references r join assets a on a.id=r.asset_id where r.game_id=p_id and a.status<>'ready') then raise exception 'ASSET_UNAVAILABLE'; end if;
 update share_links set revoked_at=now() where game_id=p_id and revoked_at is null;
 update games set status=case when p_approve then 'published' else 'draft' end,revision=revision+1,updated_at=now() where id=p_id;
 if p_approve then insert into share_links(game_id,owner_id,snapshot) values(p_id,game.owner_id,game.spec) returning id into token; end if;
 insert into audit_log(actor_id,action,target_id,details) values(p_actor,'moderate_game',p_id::text,jsonb_build_object('approved',p_approve));
 return token;
end $$;
create function public.revoke_share(p_owner uuid,p_game uuid,p_revision integer) returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from games where id=p_game and owner_id=p_owner and revision=p_revision for update;
 if not found then raise exception 'REVISION_CONFLICT'; end if;
 update share_links set revoked_at=now() where game_id=p_game and revoked_at is null;
 update games set status='draft',revision=revision+1,updated_at=now() where id=p_game;
 insert into audit_log(actor_id,action,target_id) values(p_owner,'revoke_share',p_game::text);
end $$;
create function public.manage_account(p_actor uuid,p_target uuid,p_patch jsonb) returns void language plpgsql security definer set search_path=public as $$
declare actor profiles; target profiles;
begin
 select * into actor from profiles where id=p_actor and status='active';
 select * into target from profiles where id=p_target for update;
 if actor.id is null or target.id is null then raise exception 'FORBIDDEN'; end if;
 if actor.role<>'super_admin' and not(actor.role='admin' and 'accounts'=any(actor.permissions) and target.role='teacher') then raise exception 'FORBIDDEN'; end if;
 if p_patch ?| array['role','permissions','storage_limit','upload_limit','daily_export_limit','concurrent_export_limit'] and actor.role<>'super_admin' then raise exception 'SUPER_ADMIN_REQUIRED'; end if;
 if p_actor=p_target and (p_patch ? 'role' or p_patch->>'status'<>'active') then raise exception 'SELF_LOCKOUT'; end if;
 update profiles set role=coalesce((p_patch->>'role')::account_role,role),status=coalesce((p_patch->>'status')::account_status,status),
 permissions=case when p_patch?'permissions' then array(select jsonb_array_elements_text(p_patch->'permissions')) else permissions end,
 storage_limit=coalesce((p_patch->>'storage_limit')::bigint,storage_limit),upload_limit=coalesce((p_patch->>'upload_limit')::int,upload_limit),
 daily_export_limit=coalesce((p_patch->>'daily_export_limit')::int,daily_export_limit),concurrent_export_limit=coalesce((p_patch->>'concurrent_export_limit')::int,concurrent_export_limit)
 where id=p_target;
 insert into audit_log(actor_id,action,target_id,details) values(p_actor,'manage_account',p_target::text,p_patch);
end $$;
revoke execute on function public.submit_game(uuid,uuid,integer),public.moderate_game(uuid,uuid,integer,boolean),public.revoke_share(uuid,uuid,integer),public.manage_account(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.submit_game(uuid,uuid,integer),public.moderate_game(uuid,uuid,integer,boolean),public.revoke_share(uuid,uuid,integer),public.manage_account(uuid,uuid,jsonb) to service_role;

-- Registry versions correspond to code-owned adapters. Config cannot contain executable code.
update public.template_versions set released=true,config='{"editor":"journey","pptx":"linked","maxSlides":60}' where template_type='journey' and version=1;
update public.template_versions set released=true,config='{"editor":"picture_reveal","pptx":"linear","grids":[4,6,9]}' where template_type='picture_reveal' and version=1;
update public.template_versions set released=true,config='{"editor":"word_wheel","pptx":"scripted","manualScoring":true}' where template_type='word_wheel' and version=1;
