// Stripe's API takes form-encoded bodies. Pure, and unit-tested
// (scripts/lib-test/billing.test.mjs).

export type Params = Record<string, unknown>

// Stripe takes form-encoded bodies with bracketed keys:
// { metadata: { site_id: "x" }, items: [{ price: "p" }] } becomes
// metadata[site_id]=x&items[0][price]=p.
export function formEncode(params: Params, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    const key = prefix ? `${prefix}[${k}]` : k
    if (Array.isArray(v)) v.forEach((item, i) => (item && typeof item === "object" ? formEncode(item as Params, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))))
    else if (typeof v === "object") formEncode(v as Params, key, out)
    else out.append(key, String(v))
  }
  return out
}

