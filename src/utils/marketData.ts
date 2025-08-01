export async function fetchMarketData(env: Env) {
    console.log("Fetching market data...");

    return {
        price: "$0.00278",
        marketCap: "$4.5M",
        holders: "4,912",
        dailyVolume: "$380K",
        liquidityValue: "$990K",
        updatedAt: new Date().toISOString()
    };
}