export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const measurementId = url.searchParams.get('id') || env.GA4_MEASUREMENT_ID;

  if (!measurementId) {
    return new Response('// no measurement id', {
      status: 200,
      headers: { 'Content-Type': 'application/javascript' },
    });
  }

  const gtagUrl = `https://www.googletagmanager.com/gtag/js?id=${measurementId}&l=dataLayer&cx=c`;

  const cache = caches.default;
  const cacheKey = new Request(gtagUrl);
  let cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const origin = await fetch(gtagUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer': new URL(request.url).origin + '/',
      },
    });

    if (!origin.ok) {
      return new Response(`// upstream ${origin.status}`, {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' },
      });
    }

    const body = await origin.arrayBuffer();

    // Don't cache if suspiciously small — means Google returned an error stub
    if (body.byteLength < 5000) {
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' },
      });
    }

    const response = new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });

    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    return new Response(`// proxy error: ${err.message}`, {
      status: 200,
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
}
