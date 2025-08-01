/**
 * Root endpoint handler
 */

export function rootHandler() {
    return new Response("PINK Utils API - Visit /balances for token balances or /pink-stats for consolidated stats", {
        headers: { 'Content-Type': 'text/plain' }
    });
}
