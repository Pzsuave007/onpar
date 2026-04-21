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
- Translate UI to Spanish (user's native language) — repeatedly pushed back

### P1
- Dedicated Round History page with filters (course, date range)
- Tournament stats on leaderboard (course average, hardest hole, best round)

### P2
- More game types (Closest to Pin, Longest Drive)
- Auto-submit casual rounds to active Virtual Tour on completion
- Refactor: Split server.py (~1700 lines) into routers/ and models/
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
