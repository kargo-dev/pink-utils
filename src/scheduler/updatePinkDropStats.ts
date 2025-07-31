import { PrismaClient } from '../generated/prisma/';
import { PrismaD1 } from '@prisma/adapter-d1';

async function updatePinkDropStats(env: Env): Promise<void> {
    const adapter = new PrismaD1(env.DB);
    const prisma = new PrismaClient({ adapter });
    try {
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

        // Calculate time periods for burn statistics queries
        const now = new Date();
        const oneDayAgo = new Date(now);
        oneDayAgo.setDate(now.getDate() - 1);

        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);

        const fourteenDaysAgo = new Date(now);
        fourteenDaysAgo.setDate(now.getDate() - 14);

        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);

        const sixtyDaysAgo = new Date(now);
        sixtyDaysAgo.setDate(now.getDate() - 60);


        // Query for burn amounts in different time periods with individual queries
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

        const burnedLast14Days = await prisma.transaction.aggregate({
            _sum: {
                value: true,
            },
            where: {
                functionName: 'settleTournament',
                timestamp: {
                    gte: fourteenDaysAgo.toISOString(),
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

        // Combine results into a single JSON object
        const stats = {
            pinkSpentOnTickets: toPink(pinkSpentOnTickets._sum.value),
            ticketsPurchased: toPink(pinkSpentOnTickets._sum.value) / 1000,
            rewardsClaimed: toPink(rewardsClaimed._sum.value),
            pinkBurnedByTournaments: toPink(rewardsSettled._sum.value),
            completedTournaments: completedTournaments,
            // Add burn statistics for different time periods
            burnedLast1Day: toPink(burnedLast1Day._sum.value),
            burnedLast7Days: toPink(burnedLast7Days._sum.value),
            burnedLast14Days: toPink(burnedLast14Days._sum.value),
            burnedLast30Days: toPink(burnedLast30Days._sum.value),
            burnedLast60Days: toPink(burnedLast60Days._sum.value),
        };

        // Store the JSON object in KV
        await env.PINK_UTILS_KV.put('pinkdrop_stats', JSON.stringify(stats));

        console.log('PinkDrop stats updated successfully.');
    } catch (error) {
        console.error('Error updating PinkDrop stats:', error);
    }
}

export { updatePinkDropStats };