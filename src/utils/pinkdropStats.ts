import { PrismaClient } from '../generated/prisma/';
import { PrismaD1 } from '@prisma/adapter-d1';

export async function fetchPinkDropStats(env: Env) {
    console.log("Fetching PinkDrop stats...");

    const adapter = new PrismaD1(env.DB);
    const prisma = new PrismaClient({ adapter });

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

    // Helper function to convert from raw value to PINK
    const toPink = (value: any): number => (Number(value) || 0) / 10000000000.0;

    return {
        pinkSpentOnTickets: toPink(pinkSpentOnTickets._sum.value),
        ticketsPurchased: toPink(pinkSpentOnTickets._sum.value) / 1000,
        rewardsClaimed: toPink(rewardsClaimed._sum.value),
        pinkBurnedByTournaments: toPink(rewardsSettled._sum.value),
        completedTournaments: completedTournaments,
        updatedAt: new Date().toISOString()
    };
}