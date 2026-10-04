/* Madre Oráculo · servidor mínimo en Cloudflare.
   Sirve la web (index.html) y responde a /api/verificar para comprobar pagos con Stripe. */
import { onRequestGet } from './functions/api/verificar.js';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/verificar' && request.method === 'GET') return onRequestGet({ request, env });
    return env.ASSETS.fetch(request);
  }
};
