create type public.account_role as enum ('teacher','admin','super_admin');
create type public.account_status as enum ('active','pending','suspended');
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 display_name text not null default '', role public.account_role not null default 'teacher',
 status public.account_status not null default 'active', permissions text[] not null default '{}',
 storage_limit bigint not null default 209715200 check(storage_limit>=0),
 upload_limit integer not null default 2 check(upload_limit between 1 and 20),
 daily_export_limit integer not null default 20 check(daily_export_limit>=0),
 concurrent_export_limit integer not null default 1 check(concurrent_export_limit between 1 and 10),
 created_at timestamptz not null default now()
);
create table public.app_settings (key text primary key, value jsonb not null);
insert into public.app_settings values ('require_account_approval','false');
create function public.create_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
 insert into profiles(id,display_name,status) values(new.id, left(coalesce(new.raw_user_meta_data->>'display_name',''),100),
 case when (select value='true'::jsonb from app_settings where key='require_account_approval') then 'pending'::account_status else 'active'::account_status end);
 return new;
end $$;
create trigger on_signup after insert on auth.users for each row execute function public.create_profile();
create function public.is_active() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles p join auth.users u on u.id=p.id where p.id=auth.uid() and p.status='active' and u.email_confirmed_at is not null)
$$;
create function public.has_permission(permission text) returns boolean language sql stable security definer set search_path=public as $$
 select is_active() and exists(select 1 from profiles where id=auth.uid() and (role='super_admin' or (role='admin' and permission=any(permissions))))
$$;
create table public.subjects(id text primary key, name text not null, enabled boolean not null default true);
insert into public.subjects(id,name) values ('math','Toán'),('vietnamese','Tiếng Việt'),('science','Tự nhiên và Xã hội'),('ethics','Đạo đức'),('technology','Công nghệ'),('other','Khác');
create table public.templates(type text primary key check(type in ('journey','picture_reveal','word_wheel')), name text not null);
insert into public.templates values ('journey','Hành trình tri thức'),('picture_reveal','Mảnh ghép bí mật'),('word_wheel','Vòng quay ô chữ');
create table public.template_versions(template_type text references templates, version integer, released boolean not null default false, config jsonb not null default '{}', primary key(template_type,version));
insert into public.template_versions(template_type,version) values ('journey',1),('picture_reveal',1),('word_wheel',1);
create table public.assets (
 id uuid primary key default gen_random_uuid(), owner_id uuid references profiles, name text not null,
 path text unique, thumbnail_path text, mime text, bytes bigint not null default 0 check(bytes>=0),
 width integer, height integer, status text not null default 'pending' check(status in ('pending','processing','ready','failed','deleted')),
 source text, license text, approved boolean not null default false, created_at timestamptz not null default now()
);
create table public.games (
 id uuid primary key, owner_id uuid not null references profiles, spec jsonb not null check(jsonb_typeof(spec->'schemaVersion')='number' and spec->>'schemaVersion'='1'),
 revision integer not null default 1, status text not null default 'draft' check(status in ('draft','pending','published','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.games(owner_id,updated_at desc);
create table public.asset_references(game_id uuid references games on delete cascade, asset_id uuid references assets, primary key(game_id,asset_id));
create table public.questions(id uuid primary key default gen_random_uuid(),owner_id uuid not null references profiles,body jsonb not null,revision integer not null default 1,created_at timestamptz not null default now());
create table public.play_sessions(id uuid primary key default gen_random_uuid(),owner_id uuid not null references profiles,game_id uuid references games on delete set null,result jsonb not null default '{}',created_at timestamptz not null default now());
create table public.jobs (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references profiles,
 kind text not null check(kind in ('upload','export')), idempotency_key text not null,
 payload jsonb not null, status text not null default 'queued' check(status in ('queued','running','completed','failed')),
 attempts integer not null default 0, lease_token uuid, lease_until timestamptz, result jsonb, error text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(owner_id,kind,idempotency_key)
);
create index on public.jobs(status,created_at);
create table public.share_links(id uuid primary key default gen_random_uuid(),game_id uuid not null references games on delete cascade,owner_id uuid not null references profiles,snapshot jsonb not null,revoked_at timestamptz,created_at timestamptz not null default now());
create table public.audit_log(id bigint generated always as identity primary key,actor_id uuid references profiles,action text not null,target_id text,details jsonb not null default '{}',created_at timestamptz not null default now());

alter table public.profiles enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or has_permission('accounts'));
alter table public.app_settings enable row level security;
create policy settings_admin on public.app_settings for select to authenticated using(has_permission('operations'));
alter table public.subjects enable row level security;
create policy subjects_read on public.subjects for select using(true);
alter table public.templates enable row level security;
create policy templates_read on public.templates for select using(true);
alter table public.template_versions enable row level security;
create policy versions_read on public.template_versions for select using(true);
alter table public.assets enable row level security;
create policy assets_read on public.assets for select using((owner_id is null and approved and status='ready') or (owner_id=auth.uid() and is_active()) or has_permission('assets'));
alter table public.games enable row level security;
create policy games_read on public.games for select to authenticated using((owner_id=auth.uid() and is_active()) or has_permission('moderation'));
alter table public.asset_references enable row level security;
create policy references_read on public.asset_references for select to authenticated using(exists(select 1 from games where id=game_id and owner_id=auth.uid()) and is_active());
alter table public.questions enable row level security;
create policy questions_owner on public.questions for select to authenticated using(owner_id=auth.uid() and is_active());
alter table public.play_sessions enable row level security;
create policy sessions_read on public.play_sessions for select to authenticated using(owner_id=auth.uid() and is_active());
alter table public.jobs enable row level security;
create policy jobs_read on public.jobs for select to authenticated using(owner_id=auth.uid() and is_active());
alter table public.share_links enable row level security;
create policy shares_read on public.share_links for select to authenticated using(owner_id=auth.uid() and is_active());
alter table public.audit_log enable row level security;
create policy audit_read on public.audit_log for select to authenticated using(has_permission('audit'));

-- Only trusted API mutates records. RLS remains a second boundary for reads.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.subjects,public.templates,public.template_versions,public.assets to anon,authenticated;
grant select on public.profiles,public.games,public.questions,public.asset_references,public.play_sessions,public.jobs,public.share_links,public.audit_log,public.app_settings to authenticated;

create function public.save_game(p_owner uuid,p_spec jsonb,p_revision integer,p_assets uuid[]) returns public.games language plpgsql security definer set search_path=public as $$
declare saved games; current_row games;
begin
 if not exists(select 1 from profiles where id=p_owner and status='active') then raise exception 'ACCOUNT_INACTIVE'; end if;
 if p_spec->>'kind' is distinct from p_spec#>>'{template,type}' then raise exception 'TEMPLATE_MISMATCH'; end if;
 if not exists(select 1 from template_versions where template_type=p_spec#>>'{template,type}' and version=(p_spec#>>'{template,version}')::int) then raise exception 'UNKNOWN_TEMPLATE'; end if;
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

create function public.reserve_job(p_owner uuid,p_kind text,p_key text,p_payload jsonb,p_bytes bigint default 0) returns public.jobs language plpgsql security definer set search_path=public as $$
declare account profiles; existing jobs; reserved jobs;
begin
 select * into account from profiles where id=p_owner and status='active' for update;
 if not found then raise exception 'ACCOUNT_INACTIVE'; end if;
 select * into existing from jobs where owner_id=p_owner and kind=p_kind and idempotency_key=p_key;
 if found then return existing; end if;
 if p_kind='upload' then
  if p_bytes<=0 or p_bytes>5242880 then raise exception 'FILE_SIZE'; end if;
  if (select count(*) from jobs where owner_id=p_owner and kind='upload' and status in ('queued','running'))>=account.upload_limit then raise exception 'UPLOAD_CONCURRENCY'; end if;
  if coalesce((select sum(bytes) from assets where owner_id=p_owner and status in ('pending','processing','ready')),0)+p_bytes>account.storage_limit then raise exception 'STORAGE_QUOTA'; end if;
  insert into assets(id,owner_id,name,bytes,path) values((p_payload->>'assetId')::uuid,p_owner,left(p_payload->>'name',180),p_bytes,p_payload->>'path');
 elsif p_kind='export' then
  if (select count(*) from jobs where owner_id=p_owner and kind='export' and status in ('queued','running'))>=account.concurrent_export_limit then raise exception 'EXPORT_CONCURRENCY'; end if;
  if (select count(*) from jobs where owner_id=p_owner and kind='export' and created_at>=date_trunc('day',now()))>=account.daily_export_limit then raise exception 'EXPORT_DAILY_QUOTA'; end if;
 else raise exception 'UNKNOWN_JOB'; end if;
 insert into jobs(owner_id,kind,idempotency_key,payload) values(p_owner,p_kind,p_key,p_payload) returning * into reserved;
 return reserved;
end $$;

create function public.claim_job() returns public.jobs language plpgsql security definer set search_path=public as $$
declare claimed jobs;
begin
 update jobs set status='failed',error='Đã hết số lần thử.',updated_at=now() where status='running' and lease_until<now() and attempts>=3;
 update jobs set status='failed',error='Upload quá hạn.',updated_at=now() where kind='upload' and status='queued' and coalesce((payload->>'ready')::boolean,false)=false and created_at<now()-interval '1 hour';
 update assets set status='failed',bytes=0 where status='pending' and id in (select (payload->>'assetId')::uuid from jobs where kind='upload' and status='failed');
 select * into claimed from jobs where (status='queued' or (status='running' and lease_until<now())) and attempts<3 and (kind='export' or payload->>'ready'='true') order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 update jobs set status='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now() where id=claimed.id returning * into claimed;
 return claimed;
end $$;
revoke execute on function public.create_profile() from public,anon,authenticated;
revoke execute on function public.save_game(uuid,jsonb,integer,uuid[]) from public,anon,authenticated;
revoke execute on function public.reserve_job(uuid,text,text,jsonb,bigint) from public,anon,authenticated;
revoke execute on function public.claim_job() from public,anon,authenticated;
grant execute on function public.save_game(uuid,jsonb,integer,uuid[]),public.reserve_job(uuid,text,text,jsonb,bigint),public.claim_job() to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('uploads','uploads',false,5242880,array['image/png','image/jpeg','image/webp']),
 ('media','media',false,52428800,array['image/png','image/jpeg','image/webp','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
-- All Storage writes use a short-lived upload token issued by the trusted API.
-- No broad owner-path policy: pending files and export snapshots stay inaccessible.
