/**
 * Cloudflare Worker for PINK token utilities
 * Reintroducing itty-router with proper TypeScript typings
 */

import { AutoRouter, cors } from 'itty-router';

import { rootHandler } from './handlers/root';
import { notFoundHandler } from './handlers/notFound';
import { syncTokenTransactions } from './utils/transactions';
import { updatePinkStats } from './scheduler/updatePinkStats';
import { pinkStatsHandler } from './handlers/pinkStats';

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

// Consolidated PINK stats endpoint (includes backward compatibility)
router.get('/pink-stats', pinkStatsHandler);

// 404 handler
router.all('*', notFoundHandler);


export default {
	fetch: router.fetch,
	async scheduled(
		controller: ScheduledController,
		env: Env,
		_ctx: ExecutionContext,
	) {
		// Write code for updating your API
		switch (controller.cron) {
			case "*/10 * * * *":
				// Run on 10-minute schedule
				console.log("Syncing token transactions and updating PINK stats...");

				// Sync token transactions (needed for stats)
				await syncTokenTransactions(env);

				// Update all PINK stats in one go
				await updatePinkStats(env);
				break;
		}
	},
};