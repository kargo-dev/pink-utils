import { PrismaClient } from '../generated/prisma/';
import { PrismaD1 } from '@prisma/adapter-d1';

export async function fetchPinkDropBurnStats(env: Env) {
    console.log("Fetching burn stats...");

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

    return {
        burnedLast1Day: toPink(burnedLast1Day._sum.value),
        burnedLast7Days: toPink(burnedLast7Days._sum.value),
        burnedLast30Days: toPink(burnedLast30Days._sum.value),
        burnedLast60Days: toPink(burnedLast60Days._sum.value),
        updatedAt: new Date().toISOString()
    };
}