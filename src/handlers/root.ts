/**
 * Root endpoint handler
 */

export function rootHandler() {
    return new Response("PINK Utils API - Visit /burn for burn balances", {
        headers: { 'Content-Type': 'text/plain' }
    });
}
