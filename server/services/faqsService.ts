/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
TL;DR  -->  FAQs service with fallback

 - Fetches FAQs from the DB using shared query() wrapper
 - Wraps DB calls in try/catch and uses seedFallback for demo/mock data
 - Returns a full list of FAQs
 - Keeps service logic clean and centralized, fallback is controlled with ALLOW_SEED_FALLBACK
 - Logs clearly when mock data is being used
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { query, getServerEnv } from '../db'; // Shared DB query helper
import { seedFallback } from './seedFallback'; // Fallback handler
import faqsData from '../db/data/faqs.json'; // Mock data

export async function getFaqs() {
  const { ALLOW_SEED_FALLBACK } = getServerEnv();
  try {
    // Run SQL query to get all faqs from the DB
    const response = await query('SELECT * FROM faqs;');
    // Return only the actual data
    return response.rows;
  } catch (error) {
    // If DB fails:
    // If ALLOW_SEED_FALLBACK=true -> return the mock data
    // If ALLOW_SEED_FALLBACK=false -> throw the real DB error
    return seedFallback(error, faqsData.faqs);
  }
}
