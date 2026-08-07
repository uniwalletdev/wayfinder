// A three-function test harness.
//
// The repo has no test runner and this is not the change that should introduce
// one — but the ingestion pipeline runs unattended in CI against data that ends
// up on a hospital map, so its parsing and merging logic needs to be checked by
// something other than hope. Plain `node`, no dependencies.
let passed = 0
let failed = 0
const failures = []

export function group(name) {
  console.log(`\n${name}`)
}

export function check(name, condition, detail = "") {
  if (condition) {
    passed++
    console.log(`  ok   ${name}`)
  } else {
    failed++
    failures.push(name)
    console.log(`  FAIL ${name}${detail ? `  — ${detail}` : ""}`)
  }
}

export function throws(name, fn, pattern) {
  try {
    fn()
    check(name, false, "expected it to throw, but it returned")
  } catch (err) {
    check(name, pattern ? pattern.test(err.message) : true, err.message)
  }
}

export function report() {
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) {
    console.log(`failing: ${failures.join(", ")}`)
    process.exit(1)
  }
}
