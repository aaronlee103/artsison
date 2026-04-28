// Thin Gelato Order API client.
// Docs: https://dashboard.gelato.com/docs/orders/v4/

const GELATO_BASE = 'https://order.gelatoapis.com/v4';

function apiKey() {
  const key = process.env.GELATO_API_KEY;
  if (!key) throw new Error('GELATO_API_KEY env var is required');
  return key;
}

async function gelatoFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${GELATO_BASE}${path}`, {
    method,
    headers: {
      'X-API-KEY': apiKey(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`Gelato ${method} ${path} failed: ${res.status}`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

// Gelato canvas / fine-art / poster product UID templates.
// These UIDs need to be verified against the live Gelato catalog once the
// account is set up — the exact paper codes vary by region. Override them in
// the DB via gelato_variants.product_uid when you have the real values.
//
// Reference format (canvas example):
// canvas_product_pth-240-gsm_130x180-mm_4-0_ver
//
// The defaults below use inch-to-mm conversions and sensible Gelato paper codes.
export const DEFAULT_PRODUCT_UIDS = {
  canvas: {
    // 3:4 aspect
    'canvas:3:4:small':   'canvas_product_canvas-450-gsm_300x400-mm_4-0_ver',
    'canvas:3:4:medium':  'canvas_product_canvas-450-gsm_450x600-mm_4-0_ver',
    'canvas:3:4:large':   'canvas_product_canvas-450-gsm_600x800-mm_4-0_ver',
    // 4:3 aspect
    'canvas:4:3:small':   'canvas_product_canvas-450-gsm_400x300-mm_4-0_hor',
    'canvas:4:3:medium':  'canvas_product_canvas-450-gsm_600x450-mm_4-0_hor',
    'canvas:4:3:large':   'canvas_product_canvas-450-gsm_800x600-mm_4-0_hor',
    // 3:2 aspect
    'canvas:3:2:small':   'canvas_product_canvas-450-gsm_300x450-mm_4-0_hor',
    'canvas:3:2:medium':  'canvas_product_canvas-450-gsm_500x750-mm_4-0_hor',
    'canvas:3:2:large':   'canvas_product_canvas-450-gsm_600x900-mm_4-0_hor',
  },
  'fine-art': {
    'fine-art:3:4:small':   'flat_product_pf-250-gsm-cr_300x400-mm_4-0_ver',
    'fine-art:3:4:medium':  'flat_product_pf-250-gsm-cr_450x600-mm_4-0_ver',
    'fine-art:3:4:large':   'flat_product_pf-250-gsm-cr_600x800-mm_4-0_ver',
    'fine-art:4:3:small':   'flat_product_pf-250-gsm-cr_400x300-mm_4-0_hor',
    'fine-art:4:3:medium':  'flat_product_pf-250-gsm-cr_600x450-mm_4-0_hor',
    'fine-art:4:3:large':   'flat_product_pf-250-gsm-cr_800x600-mm_4-0_hor',
    'fine-art:3:2:small':   'flat_product_pf-250-gsm-cr_300x450-mm_4-0_hor',
    'fine-art:3:2:medium':  'flat_product_pf-250-gsm-cr_500x750-mm_4-0_hor',
    'fine-art:3:2:large':   'flat_product_pf-250-gsm-cr_600x900-mm_4-0_hor',
  },
  poster: {
    'poster:3:4:small':   'flat_product_pp-200-gsm_300x400-mm_4-0_ver',
    'poster:3:4:medium':  'flat_product_pp-200-gsm_450x600-mm_4-0_ver',
    'poster:3:4:large':   'flat_product_pp-200-gsm_600x800-mm_4-0_ver',
    'poster:4:3:small':   'flat_product_pp-200-gsm_400x300-mm_4-0_hor',
    'poster:4:3:medium':  'flat_product_pp-200-gsm_600x450-mm_4-0_hor',
    'poster:4:3:large':   'flat_product_pp-200-gsm_800x600-mm_4-0_hor',
    'poster:3:2:small':   'flat_product_pp-200-gsm_300x450-mm_4-0_hor',
    'poster:3:2:medium':  'flat_product_pp-200-gsm_500x750-mm_4-0_hor',
    'poster:3:2:large':   'flat_product_pp-200-gsm_600x900-mm_4-0_hor',
  },
  // Framed poster = premium matte 200gsm + pine wood frame.
  // UID format includes the frame color (we default to natural wood).
  // Override per-artwork if you want a different frame color.
  'framed-poster': {
    'framed-poster:3:4:small':   'framed_poster_product_pf-200-gsm_300x400-mm_natural-wood_4-0_ver',
    'framed-poster:3:4:medium':  'framed_poster_product_pf-200-gsm_450x600-mm_natural-wood_4-0_ver',
    'framed-poster:3:4:large':   'framed_poster_product_pf-200-gsm_600x800-mm_natural-wood_4-0_ver',
    'framed-poster:4:3:small':   'framed_poster_product_pf-200-gsm_400x300-mm_natural-wood_4-0_hor',
    'framed-poster:4:3:medium':  'framed_poster_product_pf-200-gsm_600x450-mm_natural-wood_4-0_hor',
    'framed-poster:4:3:large':   'framed_poster_product_pf-200-gsm_800x600-mm_natural-wood_4-0_hor',
    'framed-poster:3:2:small':   'framed_poster_product_pf-200-gsm_300x450-mm_natural-wood_4-0_hor',
    'framed-poster:3:2:medium':  'framed_poster_product_pf-200-gsm_500x750-mm_natural-wood_4-0_hor',
    'framed-poster:3:2:large':   'framed_poster_product_pf-200-gsm_600x900-mm_natural-wood_4-0_hor',
  },
};

export function defaultProductUid(format, aspect, sizeId) {
  const group = DEFAULT_PRODUCT_UIDS[format] || {};
  return group[`${format}:${aspect}:${sizeId}`] || null;
}

// Submit an order to Gelato. Expects our internal order shape.
export async function submitOrder({ order, items }) {
  const payload = {
    orderReferenceId: order.id,
    customerReferenceId: order.customer_email || order.id,
    currency: order.currency || 'USD',
    shipmentMethodUid: 'normal',
    shippingAddress: order.shipping_address,
    items: items.map((it, i) => ({
      itemReferenceId: `${order.id}-${i + 1}`,
      productUid: it.product_uid,
      files: [
        {
          type: 'default',
          url: it.print_url,
        },
      ],
      quantity: it.quantity || 1,
    })),
  };
  return gelatoFetch('/orders', { method: 'POST', body: payload });
}

export async function getOrder(gelatoOrderId) {
  return gelatoFetch(`/orders/${gelatoOrderId}`);
}
