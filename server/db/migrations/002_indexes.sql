-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
-- TL;DR  -->  index-friendly category filtering
--
--   - adds lower(category) expression indexes for controls + faqs
--   - aligns with lower(category) = lower($1) predicate in pagination.ts
--   - without these, applying lower() to the column forces a seq scan
--     even though 001_init.sql already has a btree index on raw category
--   - safe to re-run (create index if not exists)
-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


-- ----------  controls: lower(category) expression index  ----------

-- EXPLAIN evidence (what you'd see in postgres without this index):
--   explain select * from public.controls where lower(category) = lower('SOC2');
--   → Seq Scan on controls  (cost=0.00..X rows=X)
--       Filter: (lower(category) = 'soc2')       <-- scanning every row
--
-- EXPLAIN evidence (after this index is applied):
--   → Index Scan using controls_category_lower_idx on controls
--       Index Cond: (lower(category) = 'soc2')   <-- using the index directly
create index if not exists controls_category_lower_idx
  on public.controls (lower(category));
  -- expression index on lower(category) so lower(category) = lower($1) is index-friendly


-- ----------  faqs: lower(category) expression index  ----------

-- EXPLAIN evidence (what you'd see without this index):
--   explain select * from public.faqs where lower(category) = lower('Privacy');
--   → Seq Scan on faqs  (cost=0.00..X rows=X)
--       Filter: (lower(category) = 'privacy')     <-- scanning every row
--
-- EXPLAIN evidence (after this index is applied):
--   → Index Scan using faqs_category_lower_idx on faqs
--       Index Cond: (lower(category) = 'privacy') <-- using the index directly
create index if not exists faqs_category_lower_idx
  on public.faqs (lower(category));
  -- mirrors controls index -- same query pattern in buildCategorySearchWhere()


-- ----------  pagination order: already covered (no change needed)  ----------

-- 001_init.sql already has:
--   controls_updated_at_id_idx on public.controls (updated_at desc, id desc)
--   faqs_updated_at_id_idx     on public.faqs     (updated_at desc, id desc)
--
-- the service queries use: order by updated_at desc, id desc
-- these match the index exactly -- no migration needed here


-- ----------  search: ILIKE vs GIN full-text (prototype note)  ----------

-- current search predicate in pagination.ts:
--   search_text ILIKE '%needle%'
--
-- this is a sequential scan -- acceptable for prototype dataset sizes
-- the leading % wildcard prevents any btree index from being useful
--
-- the GIN infrastructure for full-text search is already in place from 001_init.sql:
--   controls_search_vector_gin on public.controls using gin (search_vector)
--   faqs_search_vector_gin     on public.faqs     using gin (search_vector)
--
-- when search becomes a proven bottleneck, switch pagination.ts predicate to:
--   search_vector @@ plainto_tsquery('english', $N)
--
-- trade-off to confirm with UI team before switching:
--   ILIKE '%..%'        --> exact substring match (e.g. "soc" matches "SOC2")
--   plainto_tsquery     --> word/stem match (e.g. "encrypt" matches "encryption")
--                           no substring -- "soc" would NOT match "SOC2"
