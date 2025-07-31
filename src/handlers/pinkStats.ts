/**
 * Unified PINK stats endpoint handler
 * Consolidates burn data, PinkDrop stats, and other PINK metrics
 */

import { error } from 'itty-router';

const BURN_DATA_KEY = 'burn_balances';
const PINKDROP_STATS_KEY = 'pinkdrop_stats';
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

        // If not, fetch individual data sources and combine them
        if (!consolidatedStats) {
            // Fetch burn data
            const burnData = await env.PINK_UTILS_KV.get(BURN_DATA_KEY, { type: 'json' });
            if (!burnData) {
                console.warn("Burn data not available");
            }

            // Fetch PinkDrop stats
            const pinkdropStats = await env.PINK_UTILS_KV.get(PINKDROP_STATS_KEY, { type: 'json' });
            if (!pinkdropStats) {
                console.warn("PinkDrop stats not available");
            }

            // Combine the data
            consolidatedStats = {
                burn: burnData || { burnBalances: {}, totalBurn: 0, lastUpdated: new Date().toISOString() },
                pinkdrop: pinkdropStats || {},
                // Additional token metrics can be added here in the future
                updatedAt: new Date().toISOString()
            };
        }

        if (!consolidatedStats) {
            return error(404, "PINK stats not available");
        }

        // Calculate cache expiry until next 15 minutes
        const now = new Date();
        const minutesUntilNext = 15 - (now.getMinutes() % 15);
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
