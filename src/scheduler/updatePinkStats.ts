/**
 * Scheduler task to update consolidated PINK stats in KV store
 * This combines burn balances, PinkDrop stats, and other PINK metrics
 */

import { fetchAllBurnBalances } from '../utils/burn';
import { PrismaClient } from '../generated/prisma/';
import { PrismaD1 } from '@prisma/adapter-d1';

// Constants
const PINK_STATS_KEY = 'pink_stats';
const KV_EXPIRATION_TTL = 60 * 60; // 1 hour in seconds

export async function updatePinkStats(env: Env) {
    try {
        console.log("Running scheduled task to update consolidated PINK stats");

        // ---------- BURN BALANCES ----------
        console.log("Fetching burn balances...");
        const burnBalances = await fetchAllBurnBalances(env);

        const burnData = {
            burnBalances,
            totalBurn: Object.values(burnBalances).reduce((sum, val) => {
                // Convert string to number if needed
                const numVal = typeof val === 'string' ? parseFloat(val) : (val || 0);
                return (sum || 0) + numVal;
            }, 0),
            lastUpdated: new Date().toISOString(),
        };

        // ---------- PINKDROP STATS ----------
        console.log("Fetching PinkDrop stats...");
        const adapter = new PrismaD1(env.DB);
        const prisma = new PrismaClient({ adapter });

        // Calculate time periods for queries
        const now = new Date();
        const oneDayAgo = new Date(now);
        oneDayAgo.setDate(now.getDate() - 1);

        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);

        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);

        const sixtyDaysAgo = new Date(now);
        sixtyDaysAgo.setDate(now.getDate() - 60);

        // Query 1: Calculate pink spent on tickets
        const pinkSpentOnTickets = await prisma.transaction.aggregate({
            _sum: {
                value: true,
            },
            where: {
                functionName: 'batchAll',
            },
        });

        // Query 2: Calculate rewards claimed
        const rewardsClaimed = await prisma.transaction.aggregate({
            _sum: {
                value: true,
            },
            where: {
                functionName: 'claimRewards',
            },
        });

        // Query 3: Calculate rewards settled in tournaments
        const rewardsSettled = await prisma.transaction.aggregate({
            _sum: {
                value: true,
            },
            where: {
                functionName: 'settleTournament',
            },
        });

        // Query 4: Calculate no of completed tournaments
        const completedTournaments = await prisma.transaction.count({
            where: {
                functionName: 'settleTournament',
            },
        });

        // Query for burn amounts in different time periods
        const burnedLast1Day = await prisma.transaction.aggregate({
            _sum: {
                value: true,
            },
            where: {
                functionName: 'settleTournament',
                timestamp: {
                    gte: oneDayAgo.toISOString(),
                },
            },
        });

        const burnedLast7Days = await prisma.transaction.aggregate({
            _sum: {
                value: true,
            },
            where: {
                functionName: 'settleTournament',
                timestamp: {
                    gte: sevenDaysAgo.toISOString(),
                },
            },
        });

        const burnedLast30Days = await prisma.transaction.aggregate({
            _sum: {
                value: true,
            },
            where: {
                functionName: 'settleTournament',
                timestamp: {
                    gte: thirtyDaysAgo.toISOString(),
                },
            },
        });

        const burnedLast60Days = await prisma.transaction.aggregate({
            _sum: {
                value: true,
            },
            where: {
                functionName: 'settleTournament',
                timestamp: {
                    gte: sixtyDaysAgo.toISOString(),
                },
            },
        });

        // Helper function to convert from raw value to PINK
        const toPink = (value: any): number => (Number(value) || 0) / 10000000000.0;

        const pinkdropStats = {
            pinkSpentOnTickets: toPink(pinkSpentOnTickets._sum.value),
            ticketsPurchased: toPink(pinkSpentOnTickets._sum.value) / 1000,
            rewardsClaimed: toPink(rewardsClaimed._sum.value),
            pinkBurnedByTournaments: toPink(rewardsSettled._sum.value),
            completedTournaments: completedTournaments,
            burnedLast1Day: toPink(burnedLast1Day._sum.value),
            burnedLast7Days: toPink(burnedLast7Days._sum.value),
            burnedLast30Days: toPink(burnedLast30Days._sum.value),
            burnedLast60Days: toPink(burnedLast60Days._sum.value),
            updatedAt: new Date().toISOString()
        };

        // ---------- MARKET DATA (placeholder, could be fetched from external APIs) ----------
        const marketData = {
            // Example placeholder data - in production this would be fetched from price APIs
            price: "$0.00278",
            marketCap: "$4.5M",
            holders: "4,912",
            dailyVolume: "$380K",
            liquidityValue: "$990K",
            updatedAt: new Date().toISOString()
        };

        // ---------- COMBINE ALL DATA ----------
        const consolidatedStats = {
            burn: burnData,
            pinkdrop: pinkdropStats,
            market: marketData,
            tokenInfo: {
                totalSupply: 2300001221,
                circulatingSupply: 2300001221 - (burnData.totalBurn || 0),
                percentBurned: ((burnData.totalBurn || 0) / 2300001221) * 100,
            },
            updatedAt: new Date().toISOString()
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
