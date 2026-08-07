#!/usr/bin/env bash
# ============================================================================
#  Find NHS hospital maps. POSIX counterpart of nhs-discover.cmd.
#
#  Run this and nothing else:
#
#      ./nhs-discover.sh
#
#  Optionally pass a number to check only that many trusts:
#
#      ./nhs-discover.sh 20
#
#  A full run covers ~215 trusts and takes a few hours, because it honours
#  every site's robots.txt and crawl delay. It saves as it goes: if it stops
#  for any reason, run it again and it continues from where it left off.
# ============================================================================
set -u

cd "$(dirname "$0")" || exit 1

echo
echo "=== Wayfinder: NHS hospital map discovery ==="
echo

# The doctor checks the toolchain, the checkout and whether this machine can
# actually reach the NHS servers. Failing here is far kinder than failing three
# stages and twenty minutes later.
if ! node scripts/nhs/doctor.mjs --strict; then
  cat <<'MSG'

=== Stopped: the preflight check failed ===

The report above says which check failed. The two usual causes:

  * This checkout does not have the pipeline on it yet. Fix with:  git pull
  * This machine cannot reach the NHS servers. Check the connection, or run
    this somewhere without a restrictive network policy.

MSG
  exit 1
fi

echo
echo "=== Fetching the NHS trust register ==="
echo
if ! npm run nhs:fetch; then
  cat <<'MSG'

=== Stopped: could not get the NHS trust register ===

Every source was refused — the messages above name which and why. This is not
necessarily your internet connection; some networks block the download host
specifically.

Manual way round it: open this in a browser,

    https://files.digital.nhs.uk/assets/ods/current/etr.zip

save the file into  data\raw\ods\  and then run:

    node scripts/nhs/fetch-ods.mjs --use-local

MSG
  exit 1
fi

echo
if [ $# -eq 0 ]; then
  echo "=== Crawling all NHS trusts. This takes a few hours. ==="
  echo "=== Safe to interrupt: run this again to continue. ==="
else
  echo "=== Crawling $1 trusts ==="
fi
echo

# node directly rather than through npm: passing flags through `npm run` needs a
# `--` separator that is easy to get wrong, and getting it wrong fails quietly.
if [ $# -eq 0 ]; then
  crawl_ok=0
  node scripts/nhs/discover-plans.mjs || crawl_ok=1
else
  crawl_ok=0
  node scripts/nhs/discover-plans.mjs --limit "$1" || crawl_ok=1
fi

if [ "$crawl_ok" -ne 0 ]; then
  echo
  echo "=== The crawl stopped early ==="
  echo "Progress was saved. Run this again to continue from where it stopped —"
  echo "nothing is lost and it will not start over."
  exit 1
fi

echo
echo "=== Saving results ==="
echo
git add data
git commit -m "Add NHS hospital map discovery results" \
  || echo "   (nothing new to commit — the results were already saved)"

if ! git push; then
  echo
  echo "=== The results were saved locally but could not be pushed ==="
  echo "The crawl worked. Only the upload failed — check the connection and"
  echo "run: git push"
  exit 1
fi

echo
echo "=== Done ==="
echo
echo "Results are in data/plan-candidates.json and have been pushed."
