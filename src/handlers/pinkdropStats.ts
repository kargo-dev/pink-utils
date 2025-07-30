/**
 * PinkDrop stats endpoint handler
 */

import { error } from 'itty-router';

const PINKDROP_STATS_KEY = 'pinkdrop_stats';

export async function pinkdropStatsHandler(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
        const cache = caches.default;
        const cacheKey = new Request(request.url);

        // Check cache first
        let response = await cache.match(cacheKey);
        if (response) {
            console.log("Serving from edge cache");
            return new Response(response.body, response);
        }

        // Fetch data from KV
        const data = await env.PINK_UTILS_KV.get(PINKDROP_STATS_KEY, { type: 'json' });

        if (!data) {
            return error(404, "PinkDrop stats not available");
        }

        // Calculate cache expiry until next half-hour
        const now = new Date();
        const minutesUntilNextHalfHour = 30 - (now.getMinutes() % 30);
        const cacheExpiry = minutesUntilNextHalfHour * 60; // Convert to seconds

        // Create response with headers
        response = new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, s-maxage=${cacheExpiry}`
            },
        });

        // Cache the response
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        console.log("Stored in edge cache with expiry:", cacheExpiry);

        return response;
    } catch (err) {
        console.error('Error fetching PinkDrop stats:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
        return error(500, "Internal Server Error");
    }
}
