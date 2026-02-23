/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
TL;DR  -->  Controls service with fallback

 - Fetches controls from the DB using shared query() wrapper
 - Wraps DB calls in try/catch and uses seedFallback for demo/mock data
 - Returns a full list or filtered by category
 - Keeps service logic clean and centralized, fallback is controlled with ALLOW_SEED_FEEDBACK
 - Logs clearly when mock data is being used
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
