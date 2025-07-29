/**
 * Burn endpoint handler
 */

import { error } from 'itty-router';

// Define the data structure for burn data
interface BurnData {
    burnBalances: Record<string, string>;
    totalBurn: number;
    lastUpdated: number;
}

// Constants
const BURN_DATA_KEY = 'burn_balances';

export async function burnHandler(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
        const cache = caches.default;
        const cacheKey = new Request(request.url);

        // Check if the response is already cached
        let response = await cache.match(cacheKey);
        if (response) {
            console.log('Serving from cache');
            return response;
        }

        // Fetch data from KV
        const data = await env.PINK_UTILS_KV.get(BURN_DATA_KEY, { type: 'json' }) as BurnData | null;

        if (!data) {
            throw error(404, "Data not available");
        }

        // Calculate time until the next cron update (top of the hour)
        const now = new Date();
        const minutesUntilNextHour = 60 - now.getMinutes();
        const cacheExpiry = minutesUntilNextHour * 60; // Convert to seconds

        // Create a new response and cache it
        response = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
        });
        response.headers.append('Cache-Control', `max-age=${cacheExpiry}`);

        // Store in cache
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        console.log('Response cached with expiry aligned to cron schedule', { cacheExpiry });

        return response;
    } catch (err) {
        console.error('Error fetching burn data:', err);
        return error(500, "Internal Server Error");
    }
}
