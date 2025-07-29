/**
 * Burn address token balance queries
 */
type EtherscanResponse = {
    status: string;
    message: string;
    result: string;
};

/**
 * Fetch token balance for a specific address on a network using Etherscan API.
 */
async function fetchTokenBalance(chainName: string, chainId: number, contractAddress: string, address: string, apikey: string): Promise<number | null> {
    const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${address}&tag=latest&apikey=${apikey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch balance for chain ${chainName}: ${response.statusText}`);
        }

        const data: EtherscanResponse = await response.json();
        if (data.status !== '1') {
            throw new Error(`Error fetching balance for ${chainName}: ${data.message}`);
        }

        return parseFloat(data.result) / 1e10;
    } catch (error) {
        console.error(`Error fetching balance for chain ${chainName}:`, error);
        return null;
    }
}

/**
 * Get burn balances for all configured networks (fetch from blockchain).
 */
export async function fetchAllBurnBalances(env: Env): Promise<Record<string, number | null>> {
    const NETWORKS = [
        {
            name: 'base',
            chainId: env.BASE.CHAIN_ID,
            rpc: env.BASE.RPC_URL,
            tokenAddress: env.BASE.PINK_CONTRACT_ADDRESS
        },
        {
            name: 'moonbeam',
            chainId: env.MOONBEAM.CHAIN_ID,
            rpc: env.MOONBEAM.RPC_URL,
            tokenAddress: env.MOONBEAM.PINK_CONTRACT_ADDRESS
        }
    ] as const;

    const result: Record<string, number | null> = {};

    await Promise.all(
        NETWORKS.map(async (network) => {
            const balance = await fetchTokenBalance(
                network.name,
                network.chainId,
                network.tokenAddress,
                env.EVM_BURN_ADDRESS,
                env.ETHERSCAN_API_KEY
            );
            result[network.name] = balance;
        })
    );

    // Add fixed Phala burn amount as a number
    result.phala = env.PHALA.BURN_AMOUNT;

    console.log(`Fetched burn balances: ${JSON.stringify(result)}`);

    return result;
}