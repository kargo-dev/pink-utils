/**
 * Scheduler task to update burn balances in KV store
 */

import { fetchAllBurnBalances } from '../utils/burn';

// Constants
const BURN_DATA_KEY = 'burn_balances';
const KV_EXPIRATION_TTL = 60 * 60; // 1 hour in seconds

export async function updateBurnBalances(env: Env) {
    try {
        console.log("Running scheduled task to update burn balances");

        // Fetch latest burn balances from blockchain
        const burnBalances = await fetchAllBurnBalances(env);

        // Create data object
        const data = {
            burnBalances,
            totalBurn: Object.values(burnBalances).reduce((sum, balance) => (sum ?? 0) + (balance || 0), 0),
            lastUpdated: new Date().toISOString(),
        };

        console.log("Storing burn balances in KV store:", data);
        // Store in KV with expiration
        await env.PINK_UTILS_KV.put(BURN_DATA_KEY, JSON.stringify(data), {
            expirationTtl: KV_EXPIRATION_TTL
        });

        console.log("Successfully updated burn balances in KV store");
    } catch (err) {
        console.error("Error updating KV store:", err);
    }
}
