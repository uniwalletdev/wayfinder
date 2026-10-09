# Hospital subscriptions

Findway is free for patients. Hospitals pay, per site, monthly or yearly, for
an **Official** listing: a badge and their branding on the site in the app, a
place at the front of the queue for map updates, and anonymous counts of how
visitors used the map. Any hospital the app knows can be listed: an NHS trust's,
a private group's, one abroad from the world data, or one people shared.

It runs on its own. A hospital signs up at `/for-hospitals`, pays through
Stripe and manages everything from `/for-hospitals/account`. Nobody at
Findway takes part unless a sign-up's email does not prove the person works
at that hospital.

## How a sign-up goes

1. **Find the hospital** at `/for-hospitals`, by country and name.
2. **Sign in with a work email** (Clerk). The claim is accepted at once when
   the address is at a domain the hospital is known by
   (`src/lib/billing/claim.ts`):
   - an NHS hospital: `nhs.net`, or the domain of its trust's website from the
     ODS register (`data/trust-websites.json`);
   - any hospital: the domain of its website, when known.

   Anything else (a free mail address, a hospital with no known website) goes
   to **Back office → Customers** as *Needs review*. Nothing is charged until
   someone approves it, after which the person pays from their account.
3. **Choose monthly or yearly.** Yearly is ten months' price. The tier (small,
   medium, large) comes from the site's map: how many floors and places it has
   (`tierFor` in `src/lib/billing/plans.ts`). Prices are in pounds in the UK,
   euros in the euro area and dollars elsewhere.
4. **Choose how to pay.**
   - *Online*: Stripe Checkout, by card or direct debit, renewed automatically.
   - *Invoice*: Stripe emails an invoice due in 30 days to the accounts
     address given, with the purchase order number on it. The hospital pays
     by bank transfer into account details Stripe gives that customer alone,
     so payments are matched without anyone reconciling them. The site is live
     at once, as a trial, while the invoice is outstanding.
5. **Accept the terms** (`/for-hospitals/terms`). The version, who and when
   are stored on the site (`TERMS_VERSION` in `src/lib/billing/plans.ts`;
   bump it when the terms change).

From then on Stripe sends renewals, receipts and reminders, and its webhook
moves the site's status (`src/lib/billing/status.ts`):

| Status | Meaning | Official in the app |
| --- | --- | --- |
| `pending` | Signed up, not paid (a checkout closed) | No |
| `review` | Waiting for staff to confirm the person works there | No |
| `trial` | Live while the first invoice or direct debit clears | Yes |
| `active` | Paid | Yes |
| `past_due` | A payment is late; Stripe is retrying | Yes |
| `lapsed` | Cancelled or never paid | No |

Whatever the status, the hospital's map never leaves Findway: a lapsed site
loses its badge and branding, not its map.

## What a hospital's account does

`/for-hospitals/account`, for the people the organisation adds by work email:

- **Managers**: billing and invoices (Stripe's customer portal: payment
  method, monthly or yearly, cancelling), logo and brand colour, adding
  sites, and adding or removing colleagues.
- **Viewers**: the sites, their status, and what visitors were guided to and
  searched for without finding (last 30 days, anonymous counts).

Logos are uploaded (PNG, JPEG or WebP up to 100 KB) and served from
`/api/official/logo/<org>`, so showing one never sends a patient's address to
another server.

## Setting it up

Needs the database, Clerk (for work-email sign-in) and Stripe.

1. In Stripe, create the account and turn on the payment methods you want
   (Settings → Payment methods): cards, Bacs Direct Debit, SEPA Direct Debit,
   and **Bank transfers** for invoices. Turn on Stripe Tax if you charge VAT.
2. Settings → Billing → **Customer portal**: allow updating payment methods,
   switching between the monthly and yearly prices, cancelling, and viewing
   invoices.
3. Settings → Billing → **Subscriptions and emails**: turn on emailing
   invoices and reminders for overdue invoices, and choose what happens to a
   subscription when an invoice stays unpaid (cancel it after 30 days is a
   good default; that is when the listing lapses).
4. Developers → **Webhooks**: add an endpoint at
   `https://<your site>/api/stripe/webhook` with these events:
   `checkout.session.completed`, `invoice.paid`, `invoice.overdue`,
   `invoice.payment_failed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
5. In the hosting project's environment variables set
   `STRIPE_SECRET_KEY` (the secret key, `sk_live_…` or `sk_test_…`) and
   `STRIPE_WEBHOOK_SECRET` (the endpoint's signing secret, `whsec_…`), and
   redeploy.

Prices need no setting up: Findway creates them in Stripe on first use from
`src/lib/billing/plans.ts`, found again by lookup key. To change prices,
edit the amounts there and bump `PRICE_VERSION`; existing subscribers keep
their price until they are moved in Stripe.

Put the procurement pack (supplier details, insurance, DTAC, DCB0129, DSPT,
DPIA template) in `public/procurement/`, under the names listed in
`public/procurement/README.md`, and each one is offered for download on
`/for-hospitals`.

Test it with test-mode keys and the Stripe CLI:
`stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## For Findway's staff

**Back office → Customers** (admins and owners): every site, its plan,
billing method, PO number and renewal date, what listed sites bring in a
year, renewals due in 90 days, a CSV export, a link to each customer in
Stripe, and the sign-ups waiting for review (approve, or turn down to free
the hospital for someone else). Every status change from Stripe and every
review is in the audit log.

## Where it lives

| | |
| --- | --- |
| `src/lib/billing/plans.ts` | Tiers, prices, currencies, terms version |
| `src/lib/billing/claim.ts` | Which emails prove someone works at a hospital |
| `src/lib/billing/status.ts` | Stripe events → site status; webhook signature check |
| `src/lib/billing/org-roles.ts` | Managers and viewers in a hospital's account |
| `src/lib/billing/stripe.ts` | The Stripe API calls |
| `src/lib/billing/signup.ts` | Sign-up and payment, end to end |
| `src/lib/billing/store.ts` | The database |
| `db/migrations/0008_subscriptions.sql` | The tables |
| `scripts/lib-test/billing.test.mjs` | The tests |
