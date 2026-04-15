# Fairway - Golf Tournament Management App

## Problem Statement
Golf sporting app for tournaments with PGA-style leaderboard. Easy tournament administration, hole-by-hole scoring, public leaderboard page, supporting both Stroke Play and Stableford formats.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Auth**: JWT email/password + Emergent Google OAuth
- **Database**: MongoDB (users, user_sessions, tournaments, scorecards, registrations)

## User Personas
1. **Tournament Admin**: Creates/manages tournaments, controls status, manages players
2. **Player**: Registers for tournaments, enters hole-by-hole scores, views stats
3. **Public Viewer**: Views leaderboard and player profiles without registration

## What's Been Implemented

### Phase 1 (April 15, 2026)
- [x] Email/password + Google OAuth authentication
- [x] Tournament CRUD (admin only)
- [x] Hole-by-hole scorecard entry (18 holes)
- [x] Both Stroke Play and Stableford scoring
- [x] PGA-style public leaderboard with tie handling
- [x] Player dashboard with stats
- [x] Admin panel with tournament/player management
- [x] Responsive mobile-friendly design

### Phase 2 (April 15, 2026)
- [x] Multi-round tournament support (1-4 rounds)
- [x] Round tabs in scorecard entry
- [x] Leaderboard aggregation across rounds (R1, R2, R3, R4 columns)
- [x] Tournament registration/enrollment flow
- [x] Register/Unregister buttons on dashboard
- [x] Registration required before scoring
- [x] Participant count on tournament cards
- [x] Player profile pages with historical stats
- [x] Clickable player names on leaderboard → profile

## Prioritized Backlog

### P1
- Player handicap integration in Stableford scoring
- Real-time leaderboard updates (WebSocket)
- Tournament invitation system (email/link)
- Course database with hole info

### P2
- Email notifications for tournament events
- PDF scorecard export
- Mobile PWA support
- Leaderboard sharing via URL
- Tournament bracket/matchplay support
