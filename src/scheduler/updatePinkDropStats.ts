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

        // Combine results into a single JSON object
        const stats = {
            pinkSpentOnTickets: (Number(pinkSpentOnTickets._sum.value) || 0) / 10000000000.0,
            ticketsPurchased: ((Number(pinkSpentOnTickets._sum.value) || 0) / 10000000000.0) / 1000,
            rewardsClaimed: (Number(rewardsClaimed._sum.value) || 0) / 10000000000.0,
            pinkBurnedByTournaments: (Number(rewardsSettled._sum.value) || 0) / 10000000000.0,
        };

        // Store the JSON object in KV
        await env.PINK_UTILS_KV.put('pinkdrop_stats', JSON.stringify(stats));

        console.log('PinkDrop stats updated successfully.');
    } catch (error) {
        console.error('Error updating PinkDrop stats:', error);
    }
}

export { updatePinkDropStats };