// Preloaded into fetch-ods.mjs by fallback.test.mjs (`node --import`) so the
// "every host refuses us" path is tested the same way everywhere.
//
// The tests were written in a sandbox where every upstream answers 403, and
// they relied on that. On a CI runner with open egress the real ORD API answers
// 200, the fetch succeeds, and the tests of the failure path fail. This stands
// in for the network: every request gets the refusal an egress proxy gives,
// body and all, so the diagnostics the tests look for are the ones a real
// refusal produces.
globalThis.fetch = async (input) => {
  const url = typeof input === "string" ? input : input.url
  const host = new URL(url).hostname
  return new Response(`Host not in allowlist: ${host}. Add this host to your network egress settings to allow access.`, {
    status: 403,
    statusText: "Forbidden",
    headers: { "content-type": "text/plain" },
  })
}
