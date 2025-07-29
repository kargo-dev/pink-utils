/**
 * Not found (404) handler
 */

export function notFoundHandler() {
    return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
    });
}
