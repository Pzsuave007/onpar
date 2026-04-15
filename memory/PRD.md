# Fairway - Golf Tournament Management App

## Original Problem Statement
Golf sporting app for tournaments with PGA-style public leaderboard. Easy administration, player hole-by-hole score entry, and intuitive UI. Expanded to include Live Scorer, AI Scorecard Scanner, Birdie Challenges, Virtual Tours, Play a Round, Privacy System, and Live Photo Feed.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Auth**: JWT email/password + Emergent Google OAuth
- **Storage**: Emergent Object Storage (for photo uploads)
- **Database**: MongoDB (users, user_sessions, tournaments, scorecards, registrations, golf_courses, challenges, tours, tournament_feed)
- **AI**: OpenAI GPT-4o Vision via Emergent LLM Key (scorecard scanning)

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
- Admin adds "guest" players by name (no account needed)
- Live Scorer page at /keeper/:tournamentId

### Phase 4 - AI Scorecard Scanner
- POST /api/courses/scan using GPT-4o vision via Emergent LLM Key
- Auto-image rotation, multiple tee support (Blue, White, Red)

### Phase 5 - Game Modes
- Play a Round, Birdie Challenge, Virtual Tours

### Phase 6 - Landing Page
- Redesigned landing page showcasing all features

### Phase 7 - Privacy System (Apr 15, 2026)
- All items PRIVATE by default, visibility toggle (private/public)
- Invite codes auto-generated, leaderboard access control
- TESTED: 100% (iteration_4.json)

### Phase 8 - Live Photo Feed (Apr 15, 2026)
- Tournament photo feed: participants + admin can upload photos with optional captions
- Photos stored in Emergent Object Storage, compressed/resized on upload
- Tab switcher on leaderboard page (Scores / Live Feed)
- Feed visible to anyone with tournament access (including leaderboard link visitors)
- Auto-refresh every 30 seconds, mobile-friendly upload button
- Instagram-style cards with player avatar, name, timestamp, photo, caption
- TESTED: 100% (iteration_5.json)

## Admin Credentials
- Email: admin@fairway.com / Password: FairwayAdmin123!
- Email: pzsuave007@gmail.com / Password: MXmedia007

## Key DB Schemas
- `users`: {email, name, role, auth_type, password_hash}
- `tournaments`: {name, course_name, scoring_format, num_rounds, max_players, visibility, invite_code, created_by}
- `scorecards`: {tournament_id, user_id, round_number, holes, total_strokes, to_par}
- `golf_courses`: {course_name, num_holes, tees}
- `challenges`: {name, course_ids, participants, visibility, invite_code}
- `tours`: {name, num_rounds, scoring_format, invite_code, visibility}
- `tournament_feed`: {photo_id, tournament_id, user_id, player_name, caption, storage_path, content_type, created_at}

## Key API Endpoints
- POST /api/courses/scan - AI scorecard scanner
- POST /api/scorecards/keeper - Live scorer score entry
- GET /api/leaderboard/{tournament_id} - Leaderboard (access-controlled)
- POST /api/tournaments/{id}/feed - Upload photo to tournament feed
- GET /api/tournaments/{id}/feed - Get tournament feed photos
- GET /api/feed/photo/{photo_id} - Serve photo binary (public)
- GET /api/tournaments/invite/{code} - Look up by invite code
- GET /api/challenges/invite/{code} - Look up by invite code

## Prioritized Backlog
### P0
- Translate UI to Spanish (user's native language)

### P1
- Round history page (view past rounds and personal stats)
- Tournament stats on leaderboard (course average, hardest hole, best round)

### P2
- More game types (Closest to Pin, Longest Drive)
- Auto-submit casual rounds to active Virtual Tour
- Refactoring: Split server.py into route modules

## 3rd Party Integrations
- Google OAuth (Emergent-managed) — configured
- OpenAI GPT-4o Vision (Emergent LLM Key) — configured
- Emergent Object Storage — configured (for photo uploads)
