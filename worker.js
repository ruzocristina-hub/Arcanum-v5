/* Tara · servidor en Cloudflare.
   - Redirige las direcciones antiguas (…workers.dev, www.) a taraoraculo.com
   - /api/verificar  comprueba un pago en Stripe (por ?id=cs_… o ?ref=mo_…)
   - /api/guia       entrega el PDF de la guía comprada (tarot o quiromancia), en el idioma pedido (?lang=), solo si el pago está confirmado
   - El PDF no se puede descargar directamente desde su dirección pública.
   Variable secreta necesaria: STRIPE_SECRET_KEY (clave restringida rk_… con LECTURA en Checkout Sessions). */
const PRINCIPAL = 'taraoraculo.com';
// Cada guía existe en 4 idiomas: /guia-tarot-tara-es.pdf, -en, -it, -pt (y lo mismo para quiromancia)
const IDIOMAS = ['es', 'en', 'it', 'pt'];
const GUIAS = {
  guia: { base: 'guia-tarot-tara', nombre: { es: 'Guia-de-Tarot-de-Tara', en: 'Taras-Tarot-Guide', it: 'Guida-ai-Tarocchi-di-Tara', pt: 'Guia-de-Taro-da-Tara' } },
  quiro: { base: 'guia-quiromancia-tara', nombre: { es: 'Guia-de-Quiromancia-de-Tara', en: 'Taras-Palmistry-Guide', it: 'Guida-alla-Chiromanzia-di-Tara', pt: 'Guia-de-Quiromancia-da-Tara' } }
};
const PRECIOS = { 499: 'personal', 699: 'carta' };

const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function buscarSesion(env, id, ref) {
  const H = { headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY } };
  if (/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions/' + id, H);
    return r.ok ? r.json() : null;
  }
  if (/^mo_[a-z0-9]{6,30}$/.test(ref)) {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions?limit=100&status=complete', H);
    return r.ok ? (((await r.json()).data || []).find(x => x.client_reference_id === ref) || null) : null;
  }
  return undefined;
}
// Las guías se distinguen por el nombre del producto comprado
async function productoDe(env, s) {
  if (PRECIOS[s.amount_subtotal]) return PRECIOS[s.amount_subtotal];
  if (![4700, 5700].includes(s.amount_subtotal)) return null;
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions/' + s.id + '/line_items', { headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY } });
  if (!r.ok) return null;
  const nombres = ((await r.json()).data || []).map(x => (x.description || '').toLowerCase()).join(' ');
  if (nombres.includes('quiromancia')) return 'quiro';
  if (nombres.includes('tarot')) return 'guia';
  return null;
}
const pagada = s => !!s && s.payment_status === 'paid' && s.status === 'complete';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname !== PRINCIPAL && (url.hostname === 'www.' + PRINCIPAL || url.hostname.endsWith('.workers.dev'))) {
      url.hostname = PRINCIPAL; url.protocol = 'https:'; url.port = '';
      return Response.redirect(url.toString(), 301);
    }
    const p = url.searchParams, id = p.get('id') || '', ref = p.get('ref') || '';

    if (url.pathname === '/api/verificar') {
      if (!env.STRIPE_SECRET_KEY) return json({ pagado: false, error: 'config' }, 500);
      const s = await buscarSesion(env, id, ref);
      if (s === undefined) return json({ pagado: false, error: 'id' }, 400);
      if (!s) return json({ pagado: false, error: 'stripe' }, 404);
      return json({ pagado: pagada(s), producto: await productoDe(env, s), id: s.id });
    }

    if (url.pathname === '/api/guia') {
      const txt = (t, st) => new Response(t, { status: st, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      if (!env.STRIPE_SECRET_KEY) return txt('Configuración pendiente.', 500);
      const s = await buscarSesion(env, id, ref);
      const prod = pagada(s) ? await productoDe(env, s) : null;
      if (!GUIAS[prod]) return txt('No hemos encontrado el pago de la guía.', 403);
      const lang = IDIOMAS.includes(p.get('lang')) ? p.get('lang') : 'es';
      const f = await env.ASSETS.fetch(new Request(url.origin + '/' + GUIAS[prod].base + '-' + lang + '.pdf'));
      if (!f.ok) return txt('Guía no disponible.', 404);
      return new Response(f.body, { headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="' + GUIAS[prod].nombre[lang] + '.pdf"', 'cache-control': 'private, no-store' } });
    }

    // Archivos que no deben verse desde fuera
    if (/^\/guia-(tarot|quiromancia)-tara(-[a-z]{2})?\.pdf$/.test(url.pathname) || url.pathname === '/worker.js' || url.pathname === '/wrangler.jsonc' || url.pathname.startsWith('/functions/')) {
      return new Response('No encontrado', { status: 404 });
    }
    return env.ASSETS.fetch(request);
  }
};
