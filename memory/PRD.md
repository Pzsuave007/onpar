# Fairway - Golf Tournament Management App

## Problem Statement
Golf sporting app for tournaments with PGA-style leaderboard. Easy tournament administration, hole-by-hole scoring, public leaderboard page, supporting both Stroke Play and Stableford formats.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Auth**: JWT email/password + Emergent Google OAuth
- **Database**: MongoDB (users, user_sessions, tournaments, scorecards collections)

## User Personas
1. **Tournament Admin**: Creates/manages tournaments, controls status, manages players
2. **Player**: Enters hole-by-hole scores, views stats, participates in tournaments
3. **Public Viewer**: Views leaderboard without registration

## Core Requirements
- [x] Email/password + Google OAuth authentication
- [x] Tournament CRUD (admin only)
- [x] Hole-by-hole scorecard entry (18 holes)
- [x] Both Stroke Play and Stableford scoring
- [x] PGA-style public leaderboard with tie handling
- [x] Player dashboard with stats
- [x] Admin panel with tournament/player management
- [x] Responsive mobile-friendly design

## What's Been Implemented (April 15, 2026)
- Full backend with 15+ API endpoints
- Landing page with hero and features
- Authentication (JWT + Google OAuth)
- Admin panel (tournament CRUD, status management, player roles)
- Player dashboard (stats, active tournaments, recent scores)
- Scorecard entry (hole-by-hole, front 9 / back 9 layout)
- Public leaderboard (PGA-style with color-coded scores)
- Admin seed endpoint

## Prioritized Backlog
### P0 (Done)
- Authentication, Tournament CRUD, Scoring, Leaderboard

### P1
- Multi-round tournament support
- Player handicap integration in Stableford
- Tournament registration/enrollment flow
- Player profile page with historical stats

### P2
- Real-time leaderboard updates (WebSocket)
- Email notifications for tournament events
- PDF scorecard export
- Course database with hole info
- Mobile PWA support
