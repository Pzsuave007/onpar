# Fairway - Golf Tournament Management App

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Auth**: JWT email/password + Emergent Google OAuth
- **Database**: MongoDB (users, user_sessions, tournaments, scorecards, registrations)

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
- "Live Scorer" button in Admin Panel for active tournaments
- Public leaderboard shows all scores (keeper-entered included)

## Admin Credentials
- Email: admin@fairway.com
- Password: FairwayAdmin123!

## Prioritized Backlog
### P1
- Spanish language option
- Shareable leaderboard URL
- Player handicap integration
### P2
- Real-time WebSocket updates
- Email notifications
- PDF scorecard export
