# Fairway - Golf Tournament Management App

## Original Problem Statement
Golf sporting app for tournaments with PGA-style public leaderboard. Easy administration, player hole-by-hole score entry, and intuitive UI. Expanded to include Live Scorer, AI Scorecard Scanner, Birdie Challenges, Virtual Tours, and Play a Round.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Auth**: JWT email/password + Emergent Google OAuth
- **Database**: MongoDB (users, user_sessions, tournaments, scorecards, registrations, golf_courses, challenges, tours)
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
- POST /api/tournaments/{id}/add-player
- POST /api/scorecards/keeper (admin enters scores for any player)
- Live Scorer page at /keeper/:tournamentId
- Player tabs, hole-by-hole compact entry, live mini-standings

### Phase 4 - AI Scorecard Scanner
- POST /api/courses/scan using GPT-4o vision via Emergent LLM Key
- Auto-image rotation for physical scorecards
- Multiple tee support (Blue, White, Red)
- Mobile-optimized Course Editor with +/- stepper buttons

### Phase 5 - Game Modes
- Play a Round (casual score tracking with course/tee selection)
- Birdie Challenge (race to birdie all holes across courses)
- Virtual Tours (async remote tournaments, invite codes, to-par leaderboard)

### Phase 6 - Landing Page (Apr 15, 2026)
- Redesigned landing page showcasing all features
- Golf course hero image, game modes section, how it works, features grid
- Stats section, CTA, footer with navigation
- Verified: Desktop + Mobile responsive ✅

## Admin Credentials
- Email: admin@fairway.com / Password: FairwayAdmin123!
- Email: pzsuave007@gmail.com / Password: MXmedia007

## Key DB Schemas
- `users`: {email, name, role, auth_type, password_hash}
- `tournaments`: {name, course_name, scoring_format, num_rounds, max_players}
- `scorecards`: {tournament_id, user_id, round_number, holes, total_strokes, to_par}
- `golf_courses`: {course_name, num_holes, tees: [{name, color, total_par, total_yardage, holes}]}
- `challenges`: {name, course_ids, participants, created_by}
- `tours`: {name, num_rounds, scoring_format, invite_code, status}

## Key API Endpoints
- POST /api/courses/scan - AI scorecard scanner
- POST /api/scorecards/keeper - Live scorer score entry
- GET /api/leaderboard/{tournament_id} - Public leaderboard
- POST /api/tours - Create virtual tour

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
