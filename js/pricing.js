// Pure pricing helpers. No storage, no DOM.
export const COUPON_DEFAULT = Object.freeze({ code: 'HT26', percent: 15, min_subtotal: 10 });

export function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  const r = Math.round((Math.abs(x) + Number.EPSILON) * 100) / 100;
  return x < 0 ? -r : r;
}

export function formatMoney(n) {
  const v = roundMoney(n);
  const [i, d] = Math.abs(v).toFixed(2).split('.');
  return (v < 0 ? '-' : '') + '$' + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + d;
}

// lines: [{unit_price, qty}]; coupon: {percent, min_subtotal, active?, expires_at?} | null
export function computeTotals(lines, coupon = null) {
  const subtotal = roundMoney((lines || []).reduce((s, l) => {
    const q = Math.max(0, Math.floor(Number(l && l.qty) || 0));
    return s + roundMoney((Number(l && l.unit_price) || 0) * q);
  }, 0));
  let discount = 0, couponApplied = false, couponReason = null;
  if (coupon) {
    const min = Number(coupon.min_subtotal ?? 0);
    if (coupon.active === false) couponReason = 'invalid';
    else if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) couponReason = 'expired';
    else if (!(subtotal > min)) couponReason = 'min_subtotal';
    else {
      const pct = Math.min(100, Math.max(0, Number(coupon.percent) || 0));
      discount = Math.min(subtotal, roundMoney(subtotal * pct / 100));
      couponApplied = true;
    }
  }
  const shipping = 0; // "Shipping included"
  const total = roundMoney(subtotal - discount + shipping);
  return { subtotal, discount, shipping, total, couponApplied, couponReason };
}
