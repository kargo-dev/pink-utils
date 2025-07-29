/**
 * Cloudflare Worker for PINK token utilities
 * Reintroducing itty-router with proper TypeScript typings
 */

import { AutoRouter, cors } from 'itty-router';

import { rootHandler } from './handlers/root';
import { burnHandler } from './handlers/burn';
import { notFoundHandler } from './handlers/notFound';
import { updateBurnBalances } from './scheduler/updateBurnBalances';
import { syncTokenTransactions } from './utils/transactions';
import { updatePinkDropStats } from './scheduler/updatePinkDropStats';
import { pinkdropStatsHandler } from './handlers/pinkdropStats';

const { preflight, corsify } = cors({
	origin: '*',
	allowMethods: ['GET', 'OPTIONS'],
	allowHeaders: ['Content-Type'],
	maxAge: 3600,
});

// Create a new router instance
const router = AutoRouter({
	before: [preflight],
	finally: [corsify],
});

// Root endpoint
router.get('/', rootHandler);

// Burn balances endpoint
router.get('/burn', burnHandler);

// Add PinkDrop stats endpoint
router.get('/pinkdrop-stats', pinkdropStatsHandler);

// 404 handler
router.all('*', notFoundHandler);

// Export Worker handlers
export default {
	fetch: router.fetch,
	async scheduled(
		controller: ScheduledController,
		env: Env,
		_ctx: ExecutionContext,
	) {
		// Write code for updating your API
		switch (controller.cron) {
			case "0 * * * *":
				// Every hour
				console.log("Updating burn balances...");
				await updateBurnBalances(env);
				break;
			case "*/5 * * * *":
				// Every 5 minutes
				console.log("Syncing token transactions...");
				await syncTokenTransactions(env);
				await updatePinkDropStats(env);
				break;
		}
	},
};