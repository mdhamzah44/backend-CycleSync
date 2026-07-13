# Deploying to Netlify

This backend now runs as a single Netlify Function (`netlify/functions/api.js`)
that wraps the existing Express app (`app.js`) with `serverless-http`. Nothing
about your routes or models had to change.

## What changed from the original repo

- **`app.js`** (new) — all of the Express app setup that used to live in
  `server.js`, minus `app.listen`. Both local dev and Netlify import this one
  file, so there's a single source of truth for routes/middleware.
- **`server.js`** — now just calls `connectDB()` and `app.listen()` for local
  development (`npm run dev`). Behavior is unchanged.
- **`netlify/functions/api.js`** (new) — the actual Netlify Function. It
  reuses the Mongo connection across warm invocations instead of reconnecting
  on every request.
- **`netlify.toml`** (new) — redirects `/api/*` (and `/health`) to the
  function, so your frontend can keep calling `https://yoursite.netlify.app/api/...`
  exactly like before.
- **`package.json`** — added `serverless-http` and `date-fns` (the latter was
  used by `utils/cyclePredictor.js` and `routes/pregnancy.js` but was missing
  from dependencies — this would have crashed on a clean install regardless of
  hosting provider).

## Two bugs fixed along the way (unrelated to Netlify)

1. `routes/cycles.js` had a stray TypeScript type annotation (`(i: any) => ...`)
   which isn't valid in a plain `.js` file — this was a hard syntax error.
2. `routes/partner.js` had a duplicated, broken block pasted after its
   `module.exports = router;` line (missing its `router.post(...)` wrapper),
   which was also a hard syntax error. The duplicate routes it contained were
   already defined correctly earlier in the same file, so the broken copy was
   simply removed.

Both would have made the server crash immediately on startup — Netlify or not
— so worth knowing about even if you deploy elsewhere.

## Deploy steps

1. Push this project to a Git repo (GitHub/GitLab/Bitbucket) connected to
   Netlify, or use `netlify deploy` from the Netlify CLI.
2. In **Site settings → Build & deploy → Environment variables**, add:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN` (optional, defaults to `30d`)
   - `GROQ_API_KEY`
   - `GOOGLE_CLIENT_ID` (and `GOOGLE_IOS_CLIENT_ID` / `GOOGLE_ANDROID_CLIENT_ID`
     if you use Google sign-in)
   - `ALLOWED_ORIGINS` — comma-separated list of frontend origins allowed to
     call the API in production, e.g. `https://your-frontend.netlify.app`
   - `NODE_ENV=production`
3. Build settings: build command `npm install`, functions directory
   `netlify/functions` (already set in `netlify.toml`).
4. Deploy. Your API will be reachable at:
   - `https://<your-site>.netlify.app/api/...` (all existing routes, unchanged)
   - `https://<your-site>.netlify.app/health` (status check)
   - Direct function URL also works: `https://<your-site>.netlify.app/.netlify/functions/api/...`

## ⚠️ Rotate your secrets

`.env.example` in the uploaded project contains what look like **real, live
credentials** checked into the file — a MongoDB Atlas connection string with a
username/password, a Groq API key, and Google OAuth client IDs. If this
repository has ever been pushed anywhere public (or even a private repo others
can see), you should treat those as compromised:

- Rotate/regenerate the MongoDB Atlas user's password (and consider
  regenerating the whole connection string).
- Revoke and regenerate the Groq API key.
- Set the real values only as Netlify environment variables (never commit
  them to `.env.example` or any tracked file — use placeholder text there
  instead).

## MongoDB network access

Serverless functions call out from Netlify's infrastructure with IPs that
change and aren't publishable in advance. In MongoDB Atlas → Network Access,
either allow `0.0.0.0/0` (all IPs, common for serverless) or look into Atlas's
Netlify-specific/PrivateLink integration if you need tighter access control.

## Limits worth knowing

- Netlify Functions have a request timeout (10s on the free plan, longer on
  paid plans) and no persistent local disk beyond `/tmp`. Nothing in this
  codebase currently relies on either, so you're fine.
- `node-cron` is listed as a dependency but isn't used anywhere in the routes.
  If you intended to run a scheduled job (e.g. reminder digests), that won't
  work inside a request-triggered function — you'd want a
  [Netlify Scheduled Function](https://docs.netlify.com/build/functions/scheduled-functions/)
  instead.
