/**
 * Unified PINK stats endpoint handler
 * Consolidates burn data, PinkDrop stats, and other PINK metrics
 */

import { error } from 'itty-router';

const PINK_STATS_KEY = 'pink_stats';

export async function pinkStatsHandler(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
        const cache = caches.default;
        const cacheKey = new Request(request.url);

        // Check cache first
        let response = await cache.match(cacheKey);
        if (response) {
            console.log("Serving from edge cache");
            return new Response(response.body, response);
        }

        // Check if we have consolidated stats already
        let consolidatedStats = await env.PINK_UTILS_KV.get(PINK_STATS_KEY, { type: 'json' });

        if (!consolidatedStats) {
            return error(404, "PINK stats not available");
        }

        // Calculate cache expiry until next 30 minutes
        const now = new Date();
        const minutesUntilNext = 30 - (now.getMinutes() % 30);
        const cacheExpiry = minutesUntilNext * 60; // Convert to seconds

        // Create response with headers
        response = new Response(JSON.stringify(consolidatedStats), {
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
        console.error('Error fetching PINK stats:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
        return error(500, "Internal Server Error");
    }
}
