/**
 * Burn endpoint handler
 */

import { error } from 'itty-router';

interface BurnData {
    burnBalances: Record<string, string>;
    totalBurn: number;
    lastUpdated: number;
}

const BURN_DATA_KEY = 'burn_balances';

export async function burnHandler(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
        const data = await env.PINK_UTILS_KV.get(BURN_DATA_KEY, { type: 'json' }) as BurnData | null;

        if (!data) {
            return error(404, "Burn data not found");
        }

        // Calculate cache expiry until next hour
        const now = new Date();
        const secondsToNextHour = (60 - now.getMinutes()) * 60;

        // Create response with headers
        response = new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, s-maxage=${secondsToNextHour}`
            },
        });

        // Cache the response
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        console.log("Stored in edge cache with expiry:", secondsToNextHour);

        return response;

    } catch (err) {
        console.error("Error in burnHandler:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
        return error(500, "Internal Server Error");
    }
}
