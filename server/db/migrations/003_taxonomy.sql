-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
-- TL;DR  -->  add taxonomy metadata columns
--
--   - adds section + subcategory to controls + faqs
--   - preserves category as the existing compatibility field
--   - keeps migration rerunnable with add column if not exists
--   - intentionally avoids premature extra indexes until the query contract uses them
-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


-- ----------  controls taxonomy columns  ----------

alter table if exists public.controls
  add column if not exists section text not null default 'General',
  add column if not exists subcategory text;


-- ----------  faqs taxonomy columns  ----------

alter table if exists public.faqs
  add column if not exists section text not null default 'General',
  add column if not exists subcategory text;


-- ----------  notes  ----------

-- category remains the compatibility grouping field for the current ui + query args
-- section/subcategory are added now so later search/rail-nav/ai work can read one stable taxonomy shape
-- we are not adding new section/subcategory indexes yet because the current read path does not filter on them
-- this keeps the migration minimal, avoids unused-index churn, and lets later query-contract work drive index design