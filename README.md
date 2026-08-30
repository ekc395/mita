# mita

Rank the anime you've watched by comparing them head to head, not by picking stars.

Star ratings compress badly — everything good becomes a 4, and you can't tell your
favourites apart six months later. mita asks a different question: *did you like this one
more than that one?* Answer a handful of those and it knows where the new title belongs.

## How the ranking works

You log a title and say roughly how you felt about it: **liked**, **it was fine**, or
**didn't like it**. That picks a bucket.

Inside the bucket, mita runs a binary search against the titles already there — about
log₂(n) head-to-head questions, so a 60-title bucket takes six taps, not sixty. The
position it lands on is the source of truth.

The 0–10 score is *derived* from that position, never entered by hand. Each bucket owns a
band — liked 6.7–10.0, fine 3.4–6.6, disliked 0.0–3.3 — and titles spread evenly across
it, so your top liked title is exactly 10.0, and every score is recomputed whenever the
list changes.

## What's here

- **Log and rank** — search AniList, log what you've watched, place it by comparison
- **Want to watch** — a separate list, no ranking
- **Follows and a feed** — activity from the people you follow
- **Profiles** — public by default, with a private flag honoured at the database level
- **Friends who ranked this** — see a followed user's score on any title

Recommendations (`/recs`) is a placeholder. Nothing else is stubbed.

## Status

Working. Ranking, the want list, follows, the feed and profiles have all been exercised
end to end with two accounts. Recommendations are not built, and it is not deployed
anywhere yet.

## Stack

- **Next.js 15** (App Router) + **React 19** + **Tailwind**
- **Supabase** — Postgres, auth, and row-level security
- **AniList GraphQL API** for the catalogue, cached locally in Postgres

Everything runs on free tiers, which is a constraint rather than an accident: no service
here bills, and nothing needs a paid plan to develop or deploy.

## Setup

Requires **Node 22** and a free Supabase project. There is no local database — migrations
go straight to the hosted project.

```bash
npm install
```

Create `.env.local` in the repo root:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

The anon key is safe in the browser — every table is gated by RLS. The service-role key
bypasses RLS entirely, is used only to fill the AniList cache server-side, and must never
reach a client component.

Link the project and apply the schema:

```bash
npx supabase link --project-ref <your-project-ref>
npm run db:push
npm run dev
```

Sign-in is a magic link, so you'll need a real email address you can read. AniList needs
no key.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint, zero warnings tolerated |
| `npm test` | Unit and component tests |
| `npm run db:push` | Apply pending migrations to the linked project |
| `npm run db:types` | Regenerate `lib/database.types.ts` from the live schema |

## Testing

`npm test` covers the placement algorithm, both client write paths, and the PostgREST
embed normaliser. Lint, typecheck, tests, and build all run in CI on every push.

The database has its own suite: paste `supabase/tests/ranking_smoke.sql` into the Supabase
SQL editor and run it. It asserts the scoring maths, the bucket ordering, and the RLS
rules across two users, and it is wrapped in `BEGIN … ROLLBACK`, so it is safe against a
real project.

Neither covers rendering — the feed, profiles and friend scores have no automated browser
test, and were verified by hand with two accounts.

## How it fits together

The database enforces everything. All six tables have row-level security built on one
predicate, and scoring, feed writes, and privacy are Postgres functions and triggers
rather than application code. The client decides *where* a title goes; the database
decides what that means and who may see it — the contract between them is a single
integer.

That is deliberate: a bug in the UI cannot corrupt a ranking or leak a private list.

```
app/         routes — feed, search, list, profile, ranking flow
components/  RankingWizard (the comparison UI), feed and card rendering
lib/         ranking algorithm, AniList client, Supabase clients, shared types
supabase/    migrations (the real logic) and a SQL smoke test
```

New to the codebase? Read `supabase/migrations/0001_init.sql` first. More than half the
system lives there, and the TypeScript does not make much sense without it.
