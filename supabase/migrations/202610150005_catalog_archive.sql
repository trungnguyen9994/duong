alter table public.templates add column enabled boolean not null default true;
alter table public.profiles add column email text;
update public.profiles p set email=u.email from auth.users u where p.id=u.id;
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into profiles(id,display_name,email,status) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),100),new.email,
 case when (select value='true'::jsonb from app_settings where key='require_account_approval') then 'pending'::account_status else 'active'::account_status end);
 return new;
end $$;
create function public.sync_profile_email() returns trigger language plpgsql security definer set search_path=public as $$
begin update profiles set email=new.email where id=new.id; return new; end $$;
create trigger sync_email after update of email on auth.users for each row execute function public.sync_profile_email();
revoke execute on function public.sync_profile_email() from public,anon,authenticated;

create function public.validate_game_catalog() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from subjects where id=new.spec#>>'{metadata,subjectId}') then raise exception 'UNKNOWN_SUBJECT'; end if;
 if tg_op='INSERT' then
  if not exists(select 1 from templates where type=new.spec#>>'{template,type}' and enabled) then raise exception 'TEMPLATE_DISABLED'; end if;
  if not exists(select 1 from subjects where id=new.spec#>>'{metadata,subjectId}' and enabled) then raise exception 'SUBJECT_DISABLED'; end if;
 elsif old.spec#>>'{metadata,subjectId}'<>new.spec#>>'{metadata,subjectId}' and not exists(select 1 from subjects where id=new.spec#>>'{metadata,subjectId}' and enabled) then raise exception 'SUBJECT_DISABLED'; end if;
 return new;
end $$;
create trigger game_catalog_guard before insert or update of spec on public.games for each row execute function public.validate_game_catalog();
revoke execute on function public.validate_game_catalog() from public,anon,authenticated;

create function public.archive_game(p_owner uuid,p_id uuid,p_revision integer) returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from games where id=p_id and owner_id=p_owner and revision=p_revision for update;
 if not found then raise exception 'REVISION_CONFLICT'; end if;
 update share_links set revoked_at=now() where game_id=p_id and revoked_at is null;
 update games set status='archived',revision=revision+1,updated_at=now() where id=p_id;
 insert into audit_log(actor_id,action,target_id) values(p_owner,'archive_game',p_id::text);
end $$;
revoke execute on function public.archive_game(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.archive_game(uuid,uuid,integer) to service_role;
