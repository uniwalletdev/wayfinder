# Being found by search engines and AI assistants

The app is a map drawn by JavaScript. Search engines index it poorly, and most AI crawlers (ChatGPT, Claude, Perplexity) don't run JavaScript at all. So the website also publishes plain pages that describe the hospitals, built from the same venue data the app uses.

| What | Where | Source |
| --- | --- | --- |
| A page per mapped hospital: address, entrances, every ward, department and clinic with its building and floor, common questions, and a link to directions for each place | `/hospitals/<name>` | `src/app/hospitals/[slug]/page.tsx`, `src/lib/hospital-pages.ts` |
| The list of those pages, grouped by trust | `/hospitals` | `src/app/hospitals/page.tsx` |
| Structured data (schema.org JSON-LD): each hospital, its address and the places in it; Findway as an organisation, website and app | in each page's HTML | `src/lib/structured-data.ts` |
| A Markdown summary for AI assistants ([llms.txt](https://llmstxt.org)) | `/llms.txt` | `src/lib/llms-txt.ts` |
| The sitemap, listing the hospital pages | `/sitemap.xml` | `src/app/sitemap.ts` |
| A notice to Bing and the other [IndexNow](https://www.indexnow.org) engines after each production deployment | GitHub Actions, "IndexNow" | `scripts/indexnow.mjs`, `.github/workflows/indexnow.yml` |

## Which hospitals get a page

A hospital gets a page if it is public, has a map inside, and isn't a placeholder drawing (`hasHospitalPage`). That's 65 hospitals today.

Hospitals in the NHS directory that are only located, with nothing inside, don't get a page; it would have nothing to say beyond a postcode. A hospital that is mapped later gets a page at the next deploy.

The page's address comes from the hospital's name, e.g. `/hospitals/medway-maritime-hospital`. Renaming a venue therefore moves its page.

The pages and `/llms.txt` exist only on the website. The app build leaves them out (`scripts/app-shell-build.mjs`).

## What only the owner can do

1. **Google Search Console** (search.google.com/search-console): add `findway.ai` as a domain property and verify it with the DNS record it gives you. Then submit `https://findway.ai/sitemap.xml` under Sitemaps.
2. **Bing Webmaster Tools** (bing.com/webmasters): add the site. You can import it from Search Console. Submit the same sitemap. ChatGPT search and Copilot answer from Bing's index.
3. **`NEXT_PUBLIC_SITE_URL=https://findway.ai`** in Vercel's environment variables. Every absolute address in the sitemap, canonical links, structured data and llms.txt is built from it. Without it they fall back to the Vercel production domain. If that isn't findway.ai, the IndexNow run fails and says so.
4. **The App Store link** is set: `APP_STORE_ID` in `src/lib/store-links.ts` (Findway Map, `6818029311`). The pages offer the App Store, say "iPhone", and Safari on an iPhone shows the App Store banner.

## IndexNow

The key is `public/<key>.txt`, a file whose content is its own name. Search engines fetch it to check that the site sent the list. It isn't a secret.

Vercel reports every deployment to GitHub, and each report starts the workflow. Only a finished production deployment gets past its condition; the other reports show as skipped runs. To resend the list by hand, open Actions → IndexNow → Run workflow.

Google doesn't use IndexNow. It reads the sitemap.
