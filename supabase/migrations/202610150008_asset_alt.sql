alter table public.assets add column alt_text text not null default '' check(length(alt_text)<=300);
alter table public.assets add column revision integer not null default 1;
