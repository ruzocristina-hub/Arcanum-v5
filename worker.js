/* Tara · servidor mínimo en Cloudflare.
   Sirve la web (index.html), responde a /api/verificar para comprobar pagos con Stripe
   y redirige las direcciones antiguas al dominio principal taraoraculo.com. */
import { onRequestGet } from './functions/api/verificar.js';
const PRINCIPAL = 'taraoraculo.com';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname !== PRINCIPAL && (url.hostname === 'www.' + PRINCIPAL || url.hostname.endsWith('.workers.dev'))) {
      url.hostname = PRINCIPAL; url.protocol = 'https:'; url.port = '';
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === '/api/verificar' && request.method === 'GET') return onRequestGet({ request, env });
    return env.ASSETS.fetch(request);
  }
};
