import { PrismaClient } from '../generated/prisma/';
import { PrismaD1 } from '@prisma/adapter-d1';

// Define a type for the API response
interface ApiResponse {
    status: string;
    message?: string; // Added optional message property
    result: any[];
}

// Fetch transactions from Etherscan API
async function fetchTokenTransactions(
    chainId: number,
    contractAddress: string,
    address: string,
    startblock: number,
    endblock: number,
    page: number,
    offset: number,
    sort: string,
    apiKey: string
): Promise<any> {

    const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokentx&contractaddress=${contractAddress}&address=${address}&page=${page}&offset=${offset}&startblock=${startblock}&endblock=${endblock}&sort=${sort}&apikey=${apiKey}`;
    console.log(`Fetching transactions from URL: ${url}`); // Debugging log

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch transactions: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching token transactions:', error);
        throw error;
    }
}

// Function to fetch the current block number dynamically for a given chain
async function fetchCurrentBlockNumber(chainId: number, apiKey: string): Promise<number> {
    const currentBlockResponse = await fetch(`https://api.etherscan.io/v2/api?chainid=${chainId}&module=proxy&action=eth_blockNumber&apikey=${apiKey}`);
    if (!currentBlockResponse.ok) {
        throw new Error(`Failed to fetch current block number: ${currentBlockResponse.statusText}`);
    }
    const currentBlockData: { result: string } = await currentBlockResponse.json();
    return parseInt(currentBlockData.result, 16); // Convert hex to decimal
}

// Move fetchTokenTransactionsWithRetry outside of syncTokenTransactions
const fetchTokenTransactionsWithRetry = async (
    chainId: number,
    contractAddress: string,
    address: string,
    startblock: number,
    endblock: number,
    page: number,
    offset: number,
    sort: string,
    apiKey: string,
    retries = 3
): Promise<ApiResponse> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fetchTokenTransactions(
                chainId,
                contractAddress,
                address,
                startblock,
                endblock,
                page,
                offset,
                sort,
                apiKey
            );
        } catch (error) {
            console.error(`Error on attempt ${attempt}:`, error);
            if (attempt === retries) throw error;
        }
    }
    throw new Error('Failed to fetch after retries'); // Fallback error
};

// Enhanced logging utility
const log = {
    info: (message: string, context?: any) => console.log(`[INFO] ${message}`, context || ''),
    warn: (message: string, context?: any) => console.warn(`[WARN] ${message}`, context || ''),
    error: (message: string, context?: any) => console.error(`[ERROR] ${message}`, context || ''),
};

// Sync transactions to D1 database
async function syncTokenTransactions(env: Env): Promise<void> {
    const adapter = new PrismaD1(env.DB);
    const prisma = new PrismaClient({ adapter });

    const chainId = 1284;
    const contractAddress = env.MOONBEAM.PINK_CONTRACT_ADDRESS;
    const address = env.PINKDROP_CONTRACT_ADDRESS;
    const apiKey = env.ETHERSCAN_API_KEY;

    try {
        const latestTransaction = await prisma.transaction.findFirst({
            orderBy: { blockNumber: 'desc' },
        });
        let startblock = latestTransaction ? latestTransaction.blockNumber + 1 : 0;

        log.info('Starting synchronization process.', { startblock });

        const endblock = await fetchCurrentBlockNumber(chainId, apiKey);
        log.info('Fetched latest block number from API.', { endblock });

        const sort = "asc";
        let totalFetched = 0;
        let totalInserted = 0;

        log.info('Synchronization range determined.', { startblock, endblock });

        while (startblock < endblock) {
            try {
                const response: ApiResponse = await fetchTokenTransactionsWithRetry(
                    chainId,
                    contractAddress,
                    address,
                    startblock,
                    endblock,
                    1,
                    10000,
                    sort,
                    apiKey
                );

                if (!response || !Array.isArray(response.result)) {
                    if (response.status === '0' && response.message === 'No transactions found') {
                        log.info('No transactions found for the current range.', { startblock, endblock });
                        break; // Exit the loop as all transactions have been fetched
                    }
                    log.error('Invalid API response.', { response });
                    break;
                }

                if (response.result.length === 0) {
                    log.warn('Empty response received for block range.', { startblock, endblock });
                    break;
                }

                const transactions = response.result;
                log.info('Transactions fetched from API.', { count: transactions.length });

                const uniqueTransactions = transactions.filter((tx: any) => {
                    if (tx.isError === "1") {
                        log.warn('Excluding failed transaction.', { hash: tx.hash });
                        return false;
                    }
                    return true;
                });

                totalFetched += transactions.length;

                if (uniqueTransactions.length > 0) {
                    // Filter out duplicates manually
                    const existingHashes = new Set(
                        (await prisma.transaction.findMany({
                            where: {
                                hash: { in: uniqueTransactions.map((tx: any) => tx.hash) },
                            },
                            select: { hash: true },
                        })).map((tx) => tx.hash)
                    );

                    const newTransactions = uniqueTransactions.filter(
                        (tx: any) => !existingHashes.has(tx.hash)
                    );

                    if (newTransactions.length > 0) {
                        try {
                            await prisma.transaction.createMany({
                                data: newTransactions.map((tx: any) => ({
                                    hash: tx.hash,
                                    blockNumber: parseInt(tx.blockNumber, 10),
                                    blockHash: tx.blockHash,
                                    timestamp: new Date(parseInt(tx.timeStamp, 10) * 1000),
                                    from: tx.from,
                                    to: tx.to,
                                    value: tx.value,
                                    functionName: tx.functionName.split('(')[0],
                                })),
                            });

                            totalInserted += newTransactions.length;
                            log.info('Transactions inserted into database.', { count: newTransactions.length });
                        } catch (dbError) {
                            log.error('Database insertion error.', { error: dbError });
                        }
                    } else {
                        log.info('No new transactions to insert after filtering duplicates.');
                    }
                } else {
                    log.info('No new transactions to insert.');
                }

                log.info('Processed transactions.', {
                    fetched: transactions.length,
                    inserted: uniqueTransactions.length,
                });

                if (transactions.length === 10000) {
                    const lastTransaction = transactions[transactions.length - 1];
                    startblock = parseInt(lastTransaction.blockNumber, 10) + 1;
                    log.info('Hit the 10,000 transaction limit. Adjusting startblock for next fetch.', { startblock });
                    continue;
                }

                log.info('Fetched less than 10,000 transactions. Synchronization complete for this range.');
                break;
            } catch (fetchError) {
                log.error('Error during synchronization loop.', { error: fetchError });
                break;
            }
        }

        log.info('Synchronization completed.', {
            totalFetched,
            totalInserted,
        });
    } catch (error) {
        log.error('Critical error during synchronization process.', { error });
    }
}

export { syncTokenTransactions };