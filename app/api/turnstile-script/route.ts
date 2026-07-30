export const runtime = 'nodejs';
export const revalidate = 3600; // Кешируем роут на 1 час на уровне Next.js / CDN

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

export async function GET() {
  try {
    const response = await fetch(TURNSTILE_SCRIPT_URL, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Cloudflare Turnstile script: ${response.status}`);
    }

    const script = await response.text();

    return new Response(script, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Turnstile proxy error:', error);
    return new Response('// Turnstile script unavailable', {
      status: 502,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }
}