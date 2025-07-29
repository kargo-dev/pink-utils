/**
 * PinkDrop stats endpoint handler
 */

import { error } from 'itty-router';

// Constants
const PINKDROP_STATS_KEY = 'pinkdrop_stats';

export async function pinkdropStatsHandler(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
        const cache = caches.default;
        const cacheKey = new Request(request.url);

        // Check if the response is already cached
        let response = await cache.match(cacheKey);
        if (response) {
            console.log('Serving PinkDrop stats from cache');
            return response;
        }

        // Fetch data from KV
        const data = await env.PINK_UTILS_KV.get(PINKDROP_STATS_KEY, { type: 'json' });

        if (!data) {
            throw error(404, "PinkDrop stats not available");
        }

        // Calculate time until the next cron update (aligned to 30-minute intervals)
        const now = new Date();
        const minutesUntilNextHalfHour = 30 - (now.getMinutes() % 30);
        const cacheExpiry = minutesUntilNextHalfHour * 60; // Convert to seconds

        // Create a new response and cache it
        response = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' },
        });
        response.headers.append('Cache-Control', `max-age=${cacheExpiry}`);

        // Store in cache
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        console.log('PinkDrop stats cached with expiry aligned to cron schedule', { cacheExpiry });

        return response;
    } catch (err) {
        console.error('Error fetching PinkDrop stats:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
        return error(500, "Internal Server Error");
    }
}
