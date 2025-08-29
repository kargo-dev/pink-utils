/**
 * Utility functions for fetching token balances and contract data
 */


type EtherscanResponse = {
    status: string;
    message: string;
    result: string;
};

/**
 * Helper function to pause execution for a specified time
 */
async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export interface TokenBalances {
    maxSupply: number;
    totalSupply: number;
    totalSupplyPercentage: number;
    circulatingSupply: number;
    circulatingSupplyPercentage: number;
    moonbeamSupply: number;
    baseSupply: number;
    treasuryBalance: number;
    treasuryBalancePercentage: number;
    moonbeamBurnBalance: number;
    moonbeamBurnBalancePercentage: number;
    baseBurnBalance: number;
    baseBurnBalancePercentage: number;
    phalaBurnBalance: number;
    phalaBurnBalancePercentage: number;
    totalBurnBalance: number;
    totalBurnBalancePercentage: number;
    lastUpdated: string;
}

/**
 * Fetch token balance for a specific address on a network using Etherscan API.
 * 
 * @param chainName - Name of the blockchain network (e.g., 'moonbeam', 'base')
 * @param chainId - Chain ID for the network
 * @param contractAddress - Token contract address
 * @param address - Address to check balance for
 * @param apikey - Etherscan API key
 * @returns Token balance as a number or 0 if the request fails
 */
export async function fetchTokenBalance(
    chainName: string,
    chainId: number,
    contractAddress: string,
    address: string,
    apikey: string
): Promise<number> {
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

        return parseFloat(data.result) / 1e10; // Adjust decimals for PINK token
    } catch (error) {
        console.error(`Error fetching balance for chain ${chainName}:`, error);
        return 0;
    }
}

/**
 * Fetch total supply of a token on a specific network using Etherscan API.
 * 
 * @param chainName - Name of the blockchain network
 * @param chainId - Chain ID for the network
 * @param contractAddress - Token contract address
 * @param apikey - Etherscan API key
 * @returns Total supply as a number or 0 if the request fails
 */
export async function fetchTokenSupply(
    chainName: string,
    chainId: number,
    contractAddress: string,
    apikey: string
): Promise<number> {
    const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=stats&action=tokensupply&contractaddress=${contractAddress}&apikey=${apikey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch token supply for chain ${chainName}: ${response.statusText}`);
        }

        const data: EtherscanResponse = await response.json();
        if (data.status !== '1') {
            throw new Error(`Error fetching token supply for ${chainName}: ${data.message}`);
        }

        return parseFloat(data.result) / 1e10; // Adjust decimals for PINK token
    } catch (error) {
        console.error(`Error fetching token supply for chain ${chainName}:`, error);
        return 0;
    }
}

/**
 * Get all token balances and supply information.
 */
export async function fetchAllTokenBalances(env: Env): Promise<TokenBalances> {

    const maxSupply = 2300001221;

    // Fetch Moonbeam supply
    const moonbeamSupply = await fetchTokenSupply(
        env.MOONBEAM.CHAIN_NAME,
        env.MOONBEAM.CHAIN_ID,
        env.MOONBEAM.PINK_CONTRACT_ADDRESS,
        env.ETHERSCAN_API_KEY
    );
    console.log(`Moonbeam Supply: ${moonbeamSupply}`);

    await sleep(1000);

    // Fetch Base supply
    const baseSupply = await fetchTokenSupply(
        env.BASE.CHAIN_NAME,
        env.BASE.CHAIN_ID,
        env.BASE.PINK_CONTRACT_ADDRESS,
        env.ETHERSCAN_API_KEY
    );
    console.log(`Base Supply: ${baseSupply}`);

    await sleep(1000);

    // Fetch Treasury balance
    const treasuryBalance = await fetchTokenBalance(
        env.MOONBEAM.CHAIN_NAME,
        env.MOONBEAM.CHAIN_ID,
        env.MOONBEAM.PINK_CONTRACT_ADDRESS,
        env.PINK_TREASURY_ADDRESS,
        env.ETHERSCAN_API_KEY
    );
    console.log(`Treasury Balance: ${treasuryBalance}`);

    await sleep(1000);

    // Fetch Moonbeam burn balance
    const moonbeamBurnBalance = await fetchTokenBalance(
        env.MOONBEAM.CHAIN_NAME,
        env.MOONBEAM.CHAIN_ID,
        env.MOONBEAM.PINK_CONTRACT_ADDRESS,
        env.EVM_BURN_ADDRESS,
        env.ETHERSCAN_API_KEY
    );
    console.log(`Moonbeam Burn Balance: ${moonbeamBurnBalance}`);

    await sleep(1000);

    // Fetch Base burn balance
    const baseBurnBalance = await fetchTokenBalance(
        env.BASE.CHAIN_NAME,
        env.BASE.CHAIN_ID,
        env.BASE.PINK_CONTRACT_ADDRESS,
        env.EVM_BURN_ADDRESS,
        env.ETHERSCAN_API_KEY
    );
    console.log(`Base Burn Balance: ${baseBurnBalance}`);

    // Get Phala burn amount (this is a local value, no API call needed)
    const phalaBurnBalance = env.PHALA.BURN_AMOUNT;

    console.log(`Phala Burn Balance: ${phalaBurnBalance}`);

    const totalBurnBalance = moonbeamBurnBalance + baseBurnBalance + phalaBurnBalance;
    const totalBurnBalancePercentage = (totalBurnBalance / maxSupply) * 100;

    const phalaBurnBalancePercentage = (phalaBurnBalance / maxSupply) * 100;
    const moonbeamBurnBalancePercentage = (moonbeamBurnBalance / maxSupply) * 100;
    const baseBurnBalancePercentage = (baseBurnBalance / maxSupply) * 100;

    console.log(`Total Burn Balance: ${totalBurnBalance}, total burn percentage (${totalBurnBalancePercentage.toFixed(2)}%)`);

    const totalSupply = maxSupply - totalBurnBalance;
    const totalSupplyPercentage = (totalSupply / maxSupply) * 100;
    console.log(`Total Supply: ${totalSupply}, total supply percentage (${totalSupplyPercentage.toFixed(2)}%)`);

    const circulatingSupply = totalSupply - treasuryBalance;
    const circulatingSupplyPercentage = (circulatingSupply / maxSupply) * 100;
    console.log(`Circulating Supply: ${circulatingSupply}, circulating supply percentage (${circulatingSupplyPercentage.toFixed(2)}%)`);

    const treasuryBalancePercentage = (treasuryBalance / maxSupply) * 100;
    console.log(`Treasury Balance Percentage: ${treasuryBalancePercentage.toFixed(2)}%`);

    const lastUpdated = new Date().toISOString();

    return {
        maxSupply,
        totalSupply,
        totalSupplyPercentage,
        circulatingSupply,
        circulatingSupplyPercentage,
        moonbeamSupply,
        baseSupply,
        treasuryBalance,
        treasuryBalancePercentage,
        moonbeamBurnBalance,
        moonbeamBurnBalancePercentage,
        baseBurnBalance,
        baseBurnBalancePercentage,
        phalaBurnBalance,
        phalaBurnBalancePercentage,
        totalBurnBalance,
        totalBurnBalancePercentage,
        lastUpdated
    };
}
