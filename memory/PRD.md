# OnPar Live - Golf Tournament & Scoring Platform

## Original Problem Statement
Golf sporting app for tournaments with PGA-style public leaderboard. Easy administration, player hole-by-hole score entry, and intuitive UI. Expanded to include Live Scorer, AI Scorecard Scanner, Birdie Challenges, Virtual Tours, Play a Round (personal rounds with auto-handicap), Privacy System, and Live Photo Feed. Official product name: **OnPar Live**.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Auth**: JWT email/password + Emergent Google OAuth
- **Storage**: Local server file storage (/uploads/) — previously Emergent Object Storage
- **Database**: MongoDB (users, user_sessions, tournaments, scorecards, registrations, golf_courses, challenges, challenge_progress, tours, tournament_feed, rounds, photos)
- **AI**: Direct OpenAI SDK (gpt-4o-search-preview for course web-search) — user-supplied OPENAI_API_KEY
- **Deployment**: cPanel/Apache/AlmaLinux on https://onparlive.com. Frontend is pre-built in Emergent preview via bash build_prod.sh; user pulls the pre-built build/ with bash fix.sh on the server.

## What's Been Implemented

### Phase 1 - Core MVP
- Email/password + Google OAuth authentication
- Tournament CRUD, hole-by-hole scoring (18 holes)
- Both Stroke Play and Stableford formats
- PGA-style public leaderboard with tie handling
- Admin panel, player dashboard

### Phase 2 - Multi-round, Registration, Profiles
- Multi-round tournament support (1-4 rounds)
- Tournament registration/enrollment flow
- Player profile pages with historical stats

### Phase 3 - Live Scorer (Observer Mode)
- Admin adds guest players by name (no account needed)
- Live Scorer page at /keeper/:tournamentId (mobile-first carousel UI)

### Phase 4 - AI Scorecard Scanner & Course Search
- POST /api/courses/scan using GPT-4o vision
- POST /api/courses/search using gpt-4o-search-preview (web search for scorecards)
- Auto-image rotation, multiple tee support (Blue, White, Red, Gold, etc.)

### Phase 5 - Game Modes
- Play a Round, Birdie Challenge (with invite links), Virtual Tours

### Phase 6 - Landing Page
- Redesigned landing page showcasing all features

### Phase 7 - Privacy System (Apr 15, 2026)
- All items PRIVATE by default, visibility toggle (private/public)
- Invite codes auto-generated, leaderboard access control
- TESTED: iteration_4.json

### Phase 8 - Live Photo Feed (Apr 15, 2026)
- Tournament photo feed (local file storage)
- Auto-refresh every 30 seconds
- TESTED: iteration_5.json

### Phase 9 - Rebrand & Player Dashboard (Apr 2026)
- Full rebrand Fairway → OnPar Live
- Player Dashboard with avatars, auto-handicap, stats grid, round history
- Challenge Detail: Share Invite Link, Add Round (post-game entry), organizer tools
- Finish 9 holes supported on 18-hole rounds

### Phase 10 - Bug Fixes & UX Polish (Apr 21, 2026) ✅
- **Bug #1 (P0) FIXED**: PlayRound.js ReferenceError `front9/back9` used before declaration → blank screen after tee selection. Hoisted `const` declarations above usage.
- **Bug #2 (P0) FIXED**: POST /api/challenges/{id}/log-round now also inserts into `rounds` collection (source='challenge_log', challenge_id linked). Challenge-logged rounds now count in Player Dashboard history and handicap.
- **Bug #3 (P1) FIXED**: Scoring UX is now relative-to-par across PlayRound, LiveScorer, and ChallengeDetail Add Round. Display shows '–' / '0' (Par) / '+1' (Bogey) / '-1' (Birdie). Internal storage remains absolute strokes. Hole dots show short relative labels. First +/- tap from empty jumps to par or birdie.
- Additional: moved legacy-course fallback out of render body into useEffect (React best-practice).
- TESTED: iteration_6.json — 100% backend + 100% frontend.

### Phase 11 - Tournament Creation Routing Fix (Apr 22, 2026) ✅
- **Bug #4 (P0) FIXED**: "Tournament not found" toast after clicking "Create Tournament" on new tournament form. Root cause: duplicate Route `/tournament/new/edit` in App.js was matching with priority over `/tournament/:tournamentId/edit`, causing `useParams().tournamentId === undefined` → `isNew === false` → GET /api/tournaments/undefined → 404 → toast "Tournament not found". Clicking Save Changes then fired PUT /api/tournaments/undefined → also 404. Fix: removed the redundant static route so only the dynamic route remains, correctly exposing `tournamentId = "new"`.
- File touched: `/app/frontend/src/App.js` (removed 1 line).
- Verified by reproducing the bug via Playwright (captured the 404 PUT request to `/tournaments/undefined` and the toast) before applying the fix; rebuilt with `bash build_prod.sh` (new bundle: `main.1910f1da.js`). User must Save to GitHub and run `fix.sh` on the Apache server to deploy.

### Phase 12 - Match Play & Random Scorer Formats (Apr 22, 2026) ✅
- **Match Play (Bracket 1v1 with elimination)** — enabled `team_format='match_play'` end-to-end.
  - New collection: `matches` with fields `match_id, tournament_id, bracket_round, round_label, match_index, player1_id, player2_id, winner_id, status, player1_holes, player2_holes, player1_points, player2_points, is_bye`.
  - Hole-by-hole scoring: lower strokes = 1 pt, tie = 0.5 / 0.5. Match auto-completes when all holes scored; winner advances automatically to the next round.
  - Random bracket generation on demand. Any N ≥ 2 players supported; odd N → one bye picked randomly (auto-advances).
  - Endpoints: POST /api/tournaments/{id}/bracket/generate, GET /api/tournaments/{id}/bracket, POST /api/tournaments/{id}/matches/{match_id}/score, GET /api/tournaments/{id}/matches/mine.
  - Frontend: `/tournament/:id/bracket` page with bracket visualization, admin "Generate Bracket" / "Re-shuffle", score entry dialog, champion banner.
- **Random Scorer (Cross-scoring)** — enabled `team_format='random_scorer'` end-to-end.
  - Each registered player is placed in a single shuffle cycle (A→B→C→…→A). Nobody scores themselves. Every player is scored by exactly one and scores exactly one.
  - Stored as `score_assignments: [{scorer_user_id, target_user_id}]` on the tournament doc.
  - POST /api/scorecards/keeper enforces scorer/target match for non-admins when `team_format='random_scorer'`.
  - Endpoints: POST /api/tournaments/{id}/scorer-assignments/shuffle, GET /api/tournaments/{id}/scorer-assignments (with `my_target` for caller).
  - Frontend: `/tournament/:id/scorer-assignments` page shows "You're scoring: X" card and all pairings; "Shuffle" button for admin; LiveScorer now shows only the assigned target for non-admins.
- Files touched: `/app/backend/server.py` (+~250 lines, random import); `/app/frontend/src/App.js` (2 new routes); new files `Bracket.js`, `ScorerAssignments.js`; minor edits to `TournamentEdit.js` (enabled options + redirect logic) and `LiveScorer.js` (Random Scorer target handling).
- TESTED: iteration_7.json — backend 10/10 (pytest on localhost), frontend regression pass for Phase-11 fix.

### Phase 13 - Virtual Tournament Full Setup + Course Assignments (Apr 22, 2026) ✅
- **Removed the popup** for Virtual Tournament creation. Replaced by a full-page setup at `/tour/new/edit` (file `VirtualTournamentEdit.js`), mirroring the Local Tournament form.
  - New fields: `description`, `start_date`, `end_date`, `max_players`, `suggested_course_id`, `suggested_course_name`.
- **Per-participant course assignment** — each participant has `course_id` + `course_name` in the tour doc. Courses picked from the existing golf_courses DB.
  - Participant can pick/change their own course from the leaderboard row.
  - Creator or admin can assign/reassign any participant's course.
  - Shown inline on leaderboard row (flag icon + course name + pencil button for edit).
- **Tour edit flow** — creator/admin see an "Edit" button on TourDetail that navigates to `/tour/:id/edit`.
- **Join flow** — new participants auto-inherit the `suggested_course` if set, and can override later.
- **Max players enforcement** — POST /tours/{id}/join returns 400 if full.
- New endpoints: PUT /api/tours/{id}, DELETE /api/tours/{id}, PUT /api/tours/{id}/participants/{user_id}/course.
- Files touched: `/app/backend/server.py` (~+100 lines in create_tour, update_tour, delete_tour, set_participant_course, updated join_tour); `/app/frontend/src/App.js` (2 new routes); new file `VirtualTournamentEdit.js`; cleaned up `Tours.js` (removed showCreateVirtual dialog + unused imports); `TourDetail.js` (+edit button, +description + default course chips, +per-participant course editor dialog, +isAdmin/isCreator detection).
- Verified via curl against localhost: create, update, participant course assign, list.

## Admin Credentials
- Email: admin@fairway.com / Password: FairwayAdmin123!
- Email: pzsuave007@gmail.com / Password: MXmedia007 (primary admin)

## Key DB Schemas
- `users`: {email, name, role, auth_type, password_hash, avatar_url, handicap}
- `tournaments`: {name, course_name, scoring_format, num_rounds, max_players, visibility, invite_code, created_by}
- `scorecards`: {tournament_id, user_id, round_number, holes, total_strokes, to_par}
- `golf_courses`: {course_name, num_holes, tees: [{name, color, total_par, total_yardage, holes}]}
- `challenges`: {name, course_ids, participants, courses_info, visibility, invite_code, total_holes, winner_id, status}
- `challenge_progress`: {challenge_id, user_id, course_id, hole_number, par, strokes}
- `rounds`: {round_id, user_id, player_name, course_id, course_name, holes, total_strokes, total_to_par, status, completed_holes, source, challenge_id?}
- `tours`: {name, num_rounds, scoring_format, invite_code, visibility}
- `photos`: {photo_id, tournament_id, user_id, player_name, caption, storage_path, content_type, created_at}

## Key API Endpoints
- POST /api/courses/scan — AI scorecard OCR
- POST /api/courses/search — GPT-4o web search for course scorecards
- POST /api/scorecards/keeper — Live scorer score entry (admin)
- POST /api/rounds — Save personal round (auto-syncs birdies to active challenges)
- POST /api/challenges/{id}/log-round — Log a round for a challenge (now ALSO persists to rounds)
- GET /api/rounds/my — List my personal rounds (used by Player Dashboard)
- GET /api/profile/stats — Computed stats including auto-handicap
- POST /api/profile/avatar — Upload avatar image
- GET /api/leaderboard/{tournament_id} — Leaderboard (access-controlled)
- POST /api/tournaments/{id}/feed — Upload photo to tournament feed
- GET /api/tournaments/invite/{code} / GET /api/challenges/invite/{code} — Invite code lookup

## Prioritized Backlog
### P0
- Translate UI to Spanish (user's native language) — next priority after deploy of Phase 12

### P1
- Dedicated Round History page with filters (course, date range)
- Tournament stats on leaderboard (course average, hardest hole, best round)
- UX polish: replace native date inputs in TournamentEdit with shadcn Calendar component
- MatchScoreSubmit: add length validation (player1_holes / player2_holes / pars must all equal tournament.num_holes)

### P2
- More game types (Closest to Pin, Longest Drive)
- Auto-submit casual rounds to active Virtual Tour on completion
- Notification badges when a new photo is posted in a user's challenge/tournament
- Refactor: Split server.py (~1900+ lines) into routers/ and models/
- Shared helper for `rounds` insert logic used by POST /rounds and POST /challenges/{id}/log-round (code drift risk)

## 3rd Party Integrations
- Google OAuth (Emergent-managed) — configured, DO NOT TOUCH
- Direct OpenAI SDK (gpt-4o-search-preview / gpt-4o vision) — uses user's OPENAI_API_KEY
- Local server file storage (/uploads/) — replaces Emergent Object Storage

## Deployment Workflow
1. Ensure /app/frontend/.env has REACT_APP_BACKEND_URL=https://onparlive.com
2. bash build_prod.sh  (builds inside Emergent container — the server has 1GB RAM and crashes on yarn build)
3. User runs "Save to GitHub" in Emergent chat
4. User runs bash fix.sh on their cPanel server (pulls repo, copies pre-built frontend/build/)
