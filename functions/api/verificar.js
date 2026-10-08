/* Madre Oráculo · comprobación de pagos (Cloudflare)
   Rutas: /api/verificar?id=cs_...   o   /api/verificar?ref=mo_...  (referencia que la app envía a Stripe)
   Variables (Cloudflare → arcanum-v5 → Ajustes → Variables y secretos):
     STRIPE_SECRET_KEY  clave restringida de Stripe (rk_...) con permiso de LECTURA en "Checkout Sessions"
     PLINK_PERSONAL / PLINK_CARTA  ids de los enlaces de pago (plink_...)  [opcional] */
export async function onRequestGet({ request, env }) {
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const p = new URL(request.url).searchParams, id = p.get('id') || '', ref = p.get('ref') || '';
  if (!env.STRIPE_SECRET_KEY) return json({ pagado: false, error: 'config' }, 500);
  const H = { headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY } };
  let s = null;
  if (/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions/' + id, H);
    if (r.ok) s = await r.json();
  } else if (/^mo_[a-z0-9]{6,30}$/.test(ref)) {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions?limit=100&status=complete', H);
    if (r.ok) s = ((await r.json()).data || []).find(x => x.client_reference_id === ref) || null;
  } else return json({ pagado: false, error: 'id' }, 400);
  if (!s) return json({ pagado: false, error: 'stripe' }, 404);
  let producto = null;
  if (s.payment_link && s.payment_link === env.PLINK_PERSONAL) producto = 'personal';
  else if (s.payment_link && s.payment_link === env.PLINK_CARTA) producto = 'carta';
  else if (s.amount_subtotal === 499) producto = 'personal';
  else if (s.amount_subtotal === 699) producto = 'carta';
  return json({ pagado: s.payment_status === 'paid' && s.status === 'complete', producto });
}
