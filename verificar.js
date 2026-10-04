/* Madre Oráculo · comprobación de pagos (Cloudflare Pages Functions)
   Ruta: /api/verificar?id=cs_...
   Variables de entorno (Cloudflare → tu proyecto → Settings → Variables and Secrets):
     STRIPE_SECRET_KEY  clave restringida de Stripe (rk_...) con permiso de LECTURA en "Checkout Sessions"
     PLINK_PERSONAL     id del enlace de pago de la lectura personal (plink_...)   [opcional]
     PLINK_CARTA        id del enlace de pago de la carta astral (plink_...)       [opcional] */
export async function onRequestGet({ request, env }) {
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return json({ pagado: false, error: 'id' }, 400);
  if (!env.STRIPE_SECRET_KEY) return json({ pagado: false, error: 'config' }, 500);
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions/' + id, { headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY } });
  if (!r.ok) return json({ pagado: false, error: 'stripe' }, 404);
  const s = await r.json();
  let producto = null;
  if (s.payment_link && s.payment_link === env.PLINK_PERSONAL) producto = 'personal';
  else if (s.payment_link && s.payment_link === env.PLINK_CARTA) producto = 'carta';
  else if (s.amount_subtotal === 299) producto = 'personal';
  else if (s.amount_subtotal === 499) producto = 'carta';
  return json({ pagado: s.payment_status === 'paid' && s.status === 'complete', producto });
}
