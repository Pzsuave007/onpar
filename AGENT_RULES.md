# OnPar Live — Agent Rules

> **Read this BEFORE touching code.** These are rules learned the hard way. Breaking any of them has already cost this project multiple iterations.

---

## 1. Language & Communication
- Owner's native language is **Spanish**. Respond in Spanish. Keep code, variables, commit messages and API in English.
- Owner is a working golfer, not a developer. Explain what you're doing in plain terms. Do not dump JSON or stack traces at him.

---

## 2. Authentication — DO NOT TOUCH
- **NEVER modify** Google OAuth, JWT email/password flow, bcrypt, `/api/auth/*` endpoints, `AuthContext.js`, `checkAuth`, or the `fairway_token` localStorage key (the key name is kept as `fairway_token` on purpose so existing sessions don't break after the rebrand from "Fairway" to "OnPar Live").
- If a task seems to require auth changes, **stop and ask** before writing code. The owner has said this multiple times.
- Admin credentials already seeded in production MongoDB:
  - `pzsuave007@gmail.com` / `MXmedia007` (primary owner, admin)
  - `admin@fairway.com` / `FairwayAdmin123!` (backup)

---

## 3. Deployment Flow — CRITICAL

### The servers
| Environment | URL | Host |
|---|---|---|
| Production | https://onparlive.com | cPanel / Apache / AlmaLinux (owner's cPanel, **only 1 GB RAM**) |
| Preview    | https://onpar-live-golf.preview.emergentagent.com | Emergent sandbox (this container) |

### NEVER run `yarn build` on the cPanel server
The production server has 1 GB of RAM and **will crash if you try to build there**. Frontend is always pre-built inside this Emergent container.

### The correct deploy loop
```
[You in Emergent]                    [Owner on server]
 1. edit source                       
 2. bash /app/build_prod.sh          
 3. git add frontend/build/ (auto in most cases, verify!)
 4. say "run Save to Github" ───►   clicks "Save to Github" in chat
                                    5. ssh into cPanel
                                    6. bash fix.sh
                                    7. verify https://onparlive.com
```

### `/app/build_prod.sh` — what it does
- Forces `frontend/.env` to `REACT_APP_BACKEND_URL=https://onparlive.com`
- Runs `yarn install --ignore-engines` and `yarn build`
- Output lives in `/app/frontend/build/`

### `/app/fix.sh` (runs on owner's server) — systemd edition (Apr 24, 2026)
Reads from `$REPO/frontend/build/`, copies files, then `systemctl restart onpar-backend`. **If build/ isn't in the repo, frontend is kept as-is (no wipe) and backend still restarts.**

Path map on the server:
- Repo: `/home/onparliveuni2/repo`
- Backend: `/opt/onpar/backend` (Python venv, uvicorn on port 8005 — **managed by systemd, not nohup**)
- Web: `/home/onparliveuni2/public_html`
- systemd unit: `/etc/systemd/system/onpar-backend.service` (installed by `deploy/setup_systemd.sh`)

First-time setup on a fresh server: `sudo bash deploy/setup_systemd.sh` (one-time).
Every deploy after: `cd $REPO && git pull && bash fix.sh`.

Useful server commands (owner already knows these):
- `systemctl status onpar-backend`
- `systemctl restart onpar-backend`
- `journalctl -u onpar-backend -f` (live logs)

### Why systemd — the `uvicorn --reload` zombie trap that broke prod multiple times
Before the systemd migration, `fix.sh` used `nohup uvicorn server:app --reload &` and stopped it with `pkill -9 -f uvicorn`. That was fragile because `uvicorn --reload` spawns a parent reloader + worker pair; `pkill` can kill the worker while the reloader re-spawns it with the old module cache, or an orphan worker keeps holding port 8005 so the new `uvicorn` process silently fails to bind. Users ended up with "stale code" in production — backend running old code while frontend showed new UI — and saw errors like `Not Found` / `Method Not Allowed` on brand-new endpoints.

systemd owns the process group, uses `KillMode=control-group` to kill every child, and `systemctl restart` is idempotent and race-free. We also removed `--reload` from the production command — reload is a dev-only feature.

**If a future agent reverts to `nohup` / `pkill` in `fix.sh`, they WILL break prod.** The regression guard is step 5 in the new `fix.sh` — it probes recently-added endpoints (`/api/profile/clubs`, `/api/notifications`) after restart and fails the deploy with non-zero exit if any returns 404 (means stale code).

### The `.gitignore` trap (this broke prod once)
`frontend/.gitignore` USED TO have `/build` which meant "Save to Github" never pushed the compiled files. The owner ran `fix.sh` for days with no effect. This is fixed: **`/build` is commented out in `frontend/.gitignore`**. If you ever re-add it, deploys silently stop working. Do not re-add it.

### The `frontend/build/` disappearance trap (this broke prod THREE times — Apr 24, 2026)
After running `build_prod.sh`, the Emergent platform's auto-cleanup sometimes **deletes `/app/frontend/build/`** between your session steps (confirmed by auto-commits with `D frontend/build/static/js/main.*.js`). If the owner then runs `Save to Github`, the push goes out WITHOUT the bundle, they `git pull && bash fix.sh`, and the site goes blank — Apache falls back to returning `index.html` for the missing JS, the browser tries to parse HTML as JS, and the page renders empty with console error `Unexpected token '<'`.

**MANDATORY after every `bash /app/build_prod.sh`:**
1. Immediately run `cd /app && git add -f frontend/build/` to stage the build before any auto-cleanup can delete it.
2. Verify with `git status -s | grep "A  frontend/build/static/js/main"` — you should see the new JS file staged.
3. ONLY THEN tell the owner to click **"Save to Github"**. Do not chat further before he clicks it. The longer the gap between build and Save to Github, the higher the chance the build vanishes.
4. Do NOT run another `build_prod.sh` or any other long task between the build and the "Save to Github" click.

**The `fix.sh` on the server has a defense-in-depth guard (as of Apr 24, 2026):** it refuses to wipe `$WEB/static` unless the incoming build has BOTH an `index.html` AND at least one `.js` file under `static/js/`. If you ever simplify `fix.sh` again, keep that guard. Losing this guard is how prod went blank.

### `.env` workflow for testing
If you need to test in the Emergent preview during development:
1. Temporarily change `frontend/.env` to `REACT_APP_BACKEND_URL=https://onpar-live-golf.preview.emergentagent.com`
2. `sudo supervisorctl restart frontend`
3. Test via screenshot/Playwright
4. **Restore** to `https://onparlive.com` BEFORE running `build_prod.sh`
   (Actually, `build_prod.sh` will force it anyway — but restore it so nothing weird leaks.)

### Sanity check after a build
```
ls -lh /app/frontend/build/static/js/main.*.js | grep -v "map\|LICENSE"
grep -c "<your new string from this change>" /app/frontend/build/static/js/main.*.js
```
If the grep returns 0, your change didn't actually compile — investigate before telling the owner to deploy.

---

## 4. Tech Stack (what we actually use, NOT what you might assume)

### Frontend
- React + Tailwind + Shadcn UI + React Router + axios + sonner (toast) + lucide-react icons
- Auth state: localStorage `fairway_token` + AuthContext
- Env var: `process.env.REACT_APP_BACKEND_URL`

### Backend
- FastAPI + Motor (async MongoDB) + PyJWT + bcrypt
- **Single file**: `/app/backend/server.py` (~1700 lines). Refactor is in the backlog — **do not refactor unless the owner explicitly asks**. Adding routes inline is fine.
- Env: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `OPENAI_API_KEY` (direct, NOT Emergent LLM Key — see below)

### OpenAI — DIRECT, not `emergentintegrations`
- We migrated away from the Emergent LLM Key. All OpenAI calls use the **official `openai` Python SDK** with the owner's real `OPENAI_API_KEY`.
- Current model for course search: `gpt-4o-search-preview` (web-grounded).
- Do NOT install or use `emergentintegrations`. Do NOT suggest the Universal Key.

### Storage — LOCAL disk, not S3/Emergent Object Storage
- File uploads (photos, avatars) save to `/uploads/` on disk.
- On the production server this lives at `public_html/uploads/`.
- URLs returned are like `/uploads/<filename>` (served by Apache directly).
- Do not reintroduce Emergent Object Storage or any cloud bucket without explicit approval.

### Database: MongoDB (Motor)
Collections actively used:
`users`, `user_sessions`, `tournaments`, `scorecards`, `registrations`, `golf_courses`, `challenges`, `challenge_progress`, `rounds`, `tours`, `tournament_feed`, `photos`.

MongoDB responses **must exclude `_id`** (`{"_id": 0}` projection). ObjectId is not JSON-serializable.

---

## 5. UX Conventions (what the owner actually wants)

### Mobile-first, always
- Primary viewport: ~390×844 (iPhone). Test there before declaring something done.
- Big thumb-friendly controls (h-12, rounded-full, 16×16 steppers).
- Carousel / one-hole-at-a-time pattern for any hole-by-hole entry.

### Scoring display = relative to par
- Live Scorer, Play a Round, and Challenge "Add Round" all display **relative to par**: `–`, `0` (par), `+1` (bogey), `-1` (birdie), `+2`, …
- **Backend still stores absolute strokes.** Conversion is frontend-only: `strokes = par + relative`.
- First tap of `+` from empty = par. First tap of `−` from empty = birdie (par-1). Then stepper moves by ±1 stroke.
- Labels: `Eagle!` (≤-2), `Birdie!` (-1), `Par`, `Bogey` (+1), `+N` (≥2).

### Play a Round from a Challenge
- Must filter to **only the courses in that challenge**.
- Same pattern as "Add Round": 1 course → direct navigate; 2+ courses → inline picker card (`data-testid="play-course-picker"`).

### Privacy model
- Tournaments, challenges, tours are **private by default**.
- Share via invite code → public URL `/{type}/join/{code}`.
- Leaderboards accessible only to participants or link holders.

---

## 6. Common Bugs (don't repeat)

### Frontend
| Bug | Root cause | Rule |
|---|---|---|
| Blank page on `/play` | Hooks declared after early returns (Rules of Hooks violation), or `const` used before declaration | All hooks at top; read React error overlay — it tells you exactly which component. |
| `setState` during render | Side effect in render body (e.g. `setHoles(...)` inside the JSX return path) | Use `useEffect` for any state change that depends on props/state. |
| "Add Round" doesn't appear on Dashboard | Backend wasn't inserting into `rounds` | Every place that records hole scores MUST persist a `rounds` doc if you want it in history/handicap. |

### Backend
- **Every `/api/*` route must be prefixed `/api`** (Kubernetes ingress rule).
- Use `datetime.now(timezone.utc).isoformat()`, never `datetime.utcnow()`.
- Never return Mongo's `_id`. Always project it out or build a Pydantic response model.

### Deploy
- Changes don't appear in prod → 99% of the time `Save to Github` wasn't clicked OR `frontend/build/` wasn't staged. Run:
  ```
  cd /app && git status | grep build
  ```
  If you see nothing under `build/`, staging is wrong.

---

## 7. Testing Protocol

### Before declaring done
- After backend changes → curl against preview URL with admin token:
  ```
  TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"pzsuave007@gmail.com","password":"MXmedia007"}' \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
  ```
- After frontend changes → screenshot tool on viewport 390×844, inject `fairway_token` via `add_init_script` BEFORE `goto` (SPAs clear localStorage on the first checkAuth):
  ```python
  await page.add_init_script(f"localStorage.setItem('fairway_token','{token}');")
  await page.goto(URL, wait_until="networkidle")
  ```
- For big or multi-feature batches → use `testing_agent_v3_fork`.

### Pytest
- Put regression tests in `/app/backend/tests/`. Keep them small and targeted (one concern per file).

---

## 8. Key API Endpoints (reference)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | email + password → JWT |
| POST | `/api/rounds` | Save personal round. Auto-syncs birdies to active challenges via `challenge_progress`. |
| GET  | `/api/rounds/my` | Dashboard history |
| POST | `/api/challenges/{id}/log-round` | **Also inserts into `rounds`** (source='challenge_log', challenge_id set). If you change the `rounds` insert in one of these two endpoints, change the other — they drift. |
| POST | `/api/scorecards/keeper` | Admin Live Scorer submission |
| POST | `/api/courses/search` | Web-grounded GPT-4o course scorecard search |
| POST | `/api/courses/scan` | GPT-4o vision scorecard OCR |
| POST | `/api/tournaments/{id}/feed` | Photo upload (local disk) |
| GET  | `/api/feed/photo/{photo_id}` | Serves photo binary (public) |
| GET  | `/api/profile/stats` | Computes handicap from last 20 rounds |

---

## 9. Planning rules
- **Always call `ask_human` before implementing** unless the task is obviously unambiguous.
- **Never refactor without asking.** Owner has repeatedly prioritized shipping over cleanup.
- Do not suggest moving to TypeScript, Next.js, Tailwind v4, or any stack change.
- Do not suggest adding subscriptions/paywalls unless owner asks — this is currently a free tool for friends.

---

## 10. Pending work (do not pick without confirmation)

### P0
- Spanish translation of the UI (owner asks, gets pushed back repeatedly — ask before picking)

### P1
- Round History page with filters
- Tournament stats on leaderboard (hardest hole, best round, field average)

### P2
- More game types: Closest to Pin, Longest Drive
- Auto-submit casual rounds to active Virtual Tour on completion
- Shared helper for `rounds` insert (remove drift risk between `/rounds` and `/challenges/{id}/log-round`)
- Split `server.py` into `routers/` + `models/` (ONLY if owner approves)

---

## 11. Quick checklist before you hit "finish"
- [ ] Code compiles (`mcp_lint_javascript` / `mcp_lint_python` returns ✅)
- [ ] Feature tested in preview (screenshot or curl or testing agent)
- [ ] `frontend/.env` set to `https://onparlive.com`
- [ ] `bash /app/build_prod.sh` ran without errors
- [ ] `/app/frontend/build/static/js/main.*.js` has a new hash
- [ ] `git add frontend/build/` — staged files visible under `git status`
- [ ] `/app/memory/PRD.md` updated if scope/feature moved
- [ ] `/app/memory/test_credentials.md` updated if auth changed (hopefully you didn't!)
- [ ] Summary to owner is in Spanish, short, and includes next deploy step ("haz Save to Github y corre bash fix.sh")

---

Last updated: 2026-04-24 (PM) by E1 fork agent — migrated prod backend from `nohup uvicorn --reload + pkill` to a systemd service (`onpar-backend.service`). `fix.sh` now does `systemctl restart`.
