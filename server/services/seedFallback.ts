/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
TL;DR  -->  Centralized seed fallback for demo resilience

- Isolates fallback logic from services
- Controlled with a flag -> ALLOW_SEED_FALLBACK(true = demo mode, false = production)
- Logs clearly when the fallback is being used
- Returns predefined mock data if the DB were to fail
- Throws errors if the fallback is disabled 
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

export function seedFallback<T>(error: any, mockData: T): T {
  // Check if the fallback is allowed to be used
  if (process.env.ALLOW_SEED_FEEDBACK !== 'true') {
    // if false - we want to disable the fallback
    throw error;
  }
  // Log when the fallback is actually being used
  console.warn('[Warning] Currently using seed fallback data...');

  // Return the mock data
  return mockData;
}
