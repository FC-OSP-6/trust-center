/* ================================
  TL;DR  -->  create schema + seed data

  - runs sql (schema, migrations, etc.)
  - loads provided json into tables (dummy data from wireframes)
  - prints deterministic metrics for repeatable runs
  - stretch:  inserts temporary kb rows for testing
================================ */


import { ensureDbSchema, closeDbPool } from './index';  // reuse schema runner + pool cleanup


// main seed entrypoint used by db:seed scripts and local smoke runs
export async function runSeed(): Promise<void> {
  await ensureDbSchema();  // migrations must run before any inserts happen

  // TODO  -->  next task will implement controls/faqs JSON reads + upserts here
  console.log('🌱 Seed placeholder: schema ensured, no seed rows written yet');
}


// allow running this file directly without importing it (for dev scripts)
const isDirectRun = process.argv[1]?.endsWith('server/db/seed.ts');
if (isDirectRun) runSeed().catch(console.error).finally(() => closeDbPool());