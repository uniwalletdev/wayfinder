# Back office

`/admin` is where the people who run Findway manage it. `/coverage` leads there
too. It is web only: the Android and iOS apps leave it out.

| Section | What it does |
| --- | --- |
| Overview | Counts of hospitals, maps, shared venues, accounts and activity, and what needs attention |
| Coverage | Every country, site map and indoor map published, each one opening in the app |
| Venues | Venues people mapped and shared: change who can find them, mark them verified, delete them |
| Searches | What people searched for inside a hospital and did not find, grouped; mark each resolved; export CSV |
| Activity | Navigation signals by day and by hospital, aggregated; delete signals past the 30-day retention |
| Users & roles | The back office team, and every account: give or take roles, ban, unban, delete |
| Audit log | Every change made in the back office, who made it and when |
| System | Which integrations are on, database health, recent workflow runs, and starting a data refresh |

## Roles

Each role includes everything below it.

| Role | Can |
| --- | --- |
| Owner | Everything, including making someone an admin or owner, and deleting accounts |
| Admin | Accounts (ban, unban, make someone an editor or viewer), the audit log, data retention, data refreshes |
| Editor | Moderate shared venues and missed searches |
| Viewer | Read every section except accounts and the audit log; change nothing |

Anyone else who signs in is an ordinary Findway user and sees "No back office
access". Nobody can change their own role, and the owners named in
`ADMIN_EMAILS` cannot be demoted, banned or deleted from the back office, so a
deployment can never lock its owners out.

The rules live in `src/lib/backoffice/roles.ts` and are tested by
`scripts/lib-test/backoffice-roles.test.mjs`.

## Setting it up

Sign-in uses Clerk, which Findway already supports for optional accounts.

1. Create an application at dashboard.clerk.com and copy its publishable key and
   secret key.
2. In the hosting project's environment variables (Vercel: Settings,
   Environment Variables), add:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `ADMIN_EMAILS`: the email addresses of the first owners, comma separated.
3. Redeploy, open `/admin`, and sign in with one of those addresses. It must be
   verified in Clerk, which Clerk does at sign-up.
4. Give everyone else a role from Users & roles once they have signed in once.

Keys belong in the host's settings only, never in the repository, which is public.

Optional:

- `GITHUB_DISPATCH_TOKEN`: a fine-grained GitHub token with Actions read and
  write on this repository. With it, admins can start the World hospital data
  workflow from System. Without it, System links to the workflow on GitHub.

The back office also needs the shared database (`DATABASE_URL`), which the
deployment already has for world data. Its tables are created on first use; see
`db/migrations/0006_backoffice.sql`.

## How it is protected

- Every route under `/api/admin` checks the signed-in account's role on the
  server before reading or changing anything. The pages only decide what to draw.
- A change must come from the site itself: a request carrying another origin is
  refused.
- Roles are read on every request, so a demotion or ban takes effect at once.
- Destructive actions ask for confirmation, and deleting a venue or an account
  asks for its name or email to be typed.
- Every change is written to the audit log, which the back office cannot edit.
- Account emails are shown only to admins and owners.

## Working on it locally

```bash
BACKOFFICE_DEV=1 DATABASE_URL=postgres://… npm run dev
```

With `BACKOFFICE_DEV=1` under `next dev`, the back office opens as an owner
without signing in. Production builds ignore the variable.
