import { createHash } from "node:crypto"
import { query } from "./db"

// Who published a place, as far as the server can tell, so staff can stop an
// abusive publisher sharing places again (App Store guideline 1.2 asks for a
// way to block abusive users). Publishing needs no account, so the handle is
// the device's random identifier (src/lib/device-id.ts), kept only as a
// one-way hash; a signed-in publisher is also known by their account.
//
// Keys: 'd:' + 32 hex characters of SHA-256 over the device identifier, and
// 'a:' + the account id. blocked_publishers holds the ones that are blocked.

export interface PublisherKeys {
  device: string | null
  account: string | null
}

export function deviceKey(deviceId: unknown): string | null {
  if (typeof deviceId !== "string") return null
  const id = deviceId.trim()
  if (id.length < 8 || id.length > 64) return null
  return `d:${createHash("sha256").update(`findway-publisher:${id}`).digest("hex").slice(0, 32)}`
}

export function accountKey(userId: string | null | undefined): string | null {
  return userId ? `a:${userId}` : null
}

export function publisherKeys(deviceId: unknown, userId: string | null): PublisherKeys {
  return { device: deviceKey(deviceId), account: accountKey(userId) }
}

// True when either key is blocked from publishing.
export async function isBlocked(keys: PublisherKeys): Promise<boolean> {
  const list = [keys.device, keys.account].filter((k): k is string => !!k)
  if (list.length === 0) return false
  const { rows } = await query<{ n: number }>("select count(*)::int as n from public.blocked_publishers where publisher_key = any($1::text[])", [list])
  return (rows[0]?.n ?? 0) > 0
}
