// Checks the shared rules for reports and support messages (src/lib/feedback.ts)
// and the publisher keys staff block abusive publishers by
// (src/lib/publishers.ts): a key is stable for a device, never the device
// identifier itself, and junk makes no key at all.
//
// Run: node scripts/lib-test/feedback.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const F = await import(fileURLToPath(new URL("feedback.ts", SRC)))
const P = await import(fileURLToPath(new URL("publishers.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

group("topics")
check("a report reason is a report topic", F.isTopic("report", "offensive"))
check("a support topic is not a report reason", !F.isTopic("report", "privacy"))
check("a support topic", F.isTopic("support", "privacy"))
check("junk is no topic", !F.isTopic("support", "<script>") && !F.isTopic("report", 3) && !F.isTopic("report", undefined))
check("labels read as written", F.topicLabel("report", "spam") === "Spam or advertising" && F.topicLabel("support", "map") === "A map is wrong or missing")
check("an unknown topic labels as itself", F.topicLabel("support", "gone") === "gone")

group("email")
check("a plain address", F.isEmail("someone@example.org"))
check("no domain dot", !F.isEmail("someone@example"))
check("spaces", !F.isEmail("some one@example.org"))
check("too long", !F.isEmail(`${"a".repeat(250)}@example.org`))

group("publisher keys")
const id = "6f1c2a9e-3b4d-4e5f-8a7b-1c2d3e4f5a6b"
const key = P.deviceKey(id)
check("a device key is d: and 32 hex", /^d:[0-9a-f]{32}$/.test(key ?? ""))
check("the same device, the same key", P.deviceKey(id) === key && P.deviceKey(`  ${id} `) === key)
check("another device, another key", P.deviceKey("0f1c2a9e-3b4d-4e5f-8a7b-1c2d3e4f5a6b") !== key)
check("the key does not carry the identifier", !key.includes(id.slice(0, 8)))
check("junk makes no key", P.deviceKey("") === null && P.deviceKey("short") === null && P.deviceKey(42) === null && P.deviceKey("x".repeat(65)) === null)
check("an account key", P.accountKey("user_2abc") === "a:user_2abc" && P.accountKey(null) === null)
const both = P.publisherKeys(id, "user_2abc")
check("both keys together", both.device === key && both.account === "a:user_2abc")

report()
