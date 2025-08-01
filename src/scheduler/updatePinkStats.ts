/**
 * Scheduler task to update consolidated PINK stats in KV store
 * This combines burn balances, PinkDrop stats, and other PINK metrics
 */

import { fetchAllTokenBalances } from '../utils/balances';
import { fetchBurnStats } from '../utils/burn';
import { fetchMarketData } from '../utils/marketData';
import { fetchPinkDropStats } from '../utils/pinkdropStats';

const PINK_STATS_KEY = 'pink_stats';
const KV_EXPIRATION_TTL = 60 * 60;

export async function updatePinkStats(env: Env) {
    try {
        console.log("Running scheduled task to update consolidated PINK stats");

        const balancesData = await fetchAllTokenBalances(env);
        const burnStats = await fetchBurnStats(env);
        const pinkDropStats = await fetchPinkDropStats(env);
        const marketData = await fetchMarketData(env);

        // Consolidate all stats into a single object
        const consolidatedStats = {
            balances: balancesData,
            burn: burnStats,
            pinkDrop: pinkDropStats,
            marketData: marketData,
            lastUpdated: new Date().toISOString()
        };

        // Store consolidated data in KV with expiration
        await env.PINK_UTILS_KV.put(PINK_STATS_KEY, JSON.stringify(consolidatedStats), {
            expirationTtl: KV_EXPIRATION_TTL
        });

        console.log("Successfully updated consolidated PINK stats in KV store");
    } catch (err) {
        console.error("Error updating consolidated PINK stats:", err);
    }
}
