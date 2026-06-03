export const runtime = 'nodejs';

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

let cachedScript: string | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 час

export async function GET() {
  try {
    if (cachedScript && Date.now() - cacheTime < CACHE_TTL) {
      return new Response(cachedScript, {
        headers: {
          'Content-Type': 'application/javascript',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    const response = await fetch(TURNSTILE_SCRIPT_URL);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

    const script = await response.text();
    cachedScript = script;
    cacheTime = Date.now();

    return new Response(script, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Turnstile proxy error:', error);
    return new Response('// Turnstile script unavailable', {
      status: 502,
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
}