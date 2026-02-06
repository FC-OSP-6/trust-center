-- ============================================
-- TL;DR  -->  trust center base schema
--
--   - creates the minimum tables for MVP (controls + faqs)
--   - supports stable keys for upserts (control_key / faq_key)
--   - keeps re-runs safe (if exists / add column if not exists)
--   - stretch:  supports tags as text[]
--   - stretch:  supports full-text search (to_tsvector + GIN)
-- ============================================


-- ----------  extensions  ----------

-- used to generate UUIDs in postgres / supabase  -->  similar to bcrypt but for DBs
create extension if not exists "pgcrypto";




-- ----------  controls table  ----------

-- create controls  -->  one row per trust control item
create table if not exists public.controls (
  id uuid primary key default gen_random_uuid(),  -- primary key  -->  stable server-side id
  control_key text not null,  -- stable natural key for upsert  -->  like a username  ex: "cloud_security_logs_monitored_24_7"
  title text not null default '',  -- short text label  -->  UI list title
  description text not null default '',  -- long explanation  -->  UI details view
  category text not null default 'General',  -- grouping / filtering label
  source_url text,  -- optional reference link  (proof page / external doc)
  tags text[],  -- optional tags for filters + search augmentation
  created_by text not null default 'system',
  updated_by text not null default 'system',
  created_at timestamptz not null default now(),  -- created timestamp  -->  default now
  updated_at timestamptz not null default now(),  -- updated timestamp  -->  app sets on update (seed/upserts should set this)
  search_text text not null default '',  -- debug-friendly search text (precomputed)

  -- full-text search vector  -->  computed from search_text
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(search_text, ''))
  ) stored
);


-- enforce unique control keys  -->  prevents duplicates on re-seed
create unique index if not exists controls_unique_control_key
  on public.controls (lower(control_key));

-- speed up category filtering  -->  controls page buckets
create index if not exists controls_category_idx
  on public.controls (category);

-- stable ordering index  -->  supports cursor pagination later
create index if not exists controls_updated_at_id_idx
  on public.controls (updated_at desc, id desc);

-- full-text search index  -->  enables @@ queries with good performance
create index if not exists controls_search_vector_gin
  on public.controls using gin (search_vector);

-- tags containment index  -->  enables tags @> ARRAY[...] queries
create index if not exists controls_tags_gin
  on public.controls using gin (tags);




-- ----------  faqs table  ----------

-- create faqs  -->  one row per FAQ item
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),  -- primary key  -->  stable server-side id
  faq_key text not null,  -- stable natural key for upsert  -->  like a username  ex: "faq_api_protection_measures"
  question text not null default '',  -- user-facing question  -->  UI headline (ex: <details>)
  answer text not null default '',  -- user-facing answer  -->  UI content (ex: <summary>)
  category text not null default 'General',  -- grouping / filtering label
  tags text[],  -- optional tags for filters + search augmentation
  created_by text not null default 'system',
  updated_by text not null default 'system',
  created_at timestamptz not null default now(),  -- created timestamp  -->  default now
  updated_at timestamptz not null default now(),  -- updated timestamp  -->  app sets on update (seed / upserts)
  search_text text not null default '',  -- debug-friendly search text (precomputed)

  -- full-text search vector  -->  computed from search_text
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(search_text, ''))
  ) stored
);


-- enforce unique faq keys  -->  prevents duplicates on re-seed
create unique index if not exists faqs_unique_faq_key
  on public.faqs (lower(faq_key));

-- speed up category filtering  -->  faqs page buckets
create index if not exists faqs_category_idx
  on public.faqs (category);

-- stable ordering index  -->  supports cursor pagination later
create index if not exists faqs_updated_at_id_idx
  on public.faqs (updated_at desc, id desc);

-- full-text search index  -->  enables @@ queries with good performance
create index if not exists faqs_search_vector_gin
  on public.faqs using gin (search_vector);

-- tags containment index  -->  enables tags @> ARRAY[...] queries
create index if not exists faqs_tags_gin
  on public.faqs using gin (tags);




-- ----------  safety net for partial schemas  ----------

-- controls safe re-runs  -->  add missing columns without touching rows
alter table if exists public.controls
  add column if not exists control_key text,
  add column if not exists title text not null default '',
  add column if not exists description text not null default '',
  add column if not exists category text not null default 'General',
  add column if not exists source_url text,
  add column if not exists tags text[],
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists search_text text not null default '',
  add column if not exists search_vector tsvector generated always as (
    to_tsvector('english', coalesce(search_text, ''))
  ) stored;


-- faqs safe re-runs  -->  add missing columns without touching rows
alter table if exists public.faqs
  add column if not exists faq_key text,
  add column if not exists question text not null default '',
  add column if not exists answer text not null default '',
  add column if not exists category text not null default 'General',
  add column if not exists tags text[],
  add column if not exists created_by text not null default 'system',
  add column if not exists updated_by text not null default 'system',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists search_text text not null default '',
  add column if not exists search_vector tsvector generated always as (
    to_tsvector('english', coalesce(search_text, ''))
  ) stored;