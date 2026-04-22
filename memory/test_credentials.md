# Test Credentials for OnPar Live

Backend: https://onparlive.com (also used locally via REACT_APP_BACKEND_URL)

## Admin (email/password)
- Email: admin@fairway.com
- Password: FairwayAdmin123!
- Role: admin

## Primary Admin (Google OAuth)
- Email: pzsuave007@gmail.com
- Name: Paul Zacapantzi
- Role: admin
- Note: Seeded via Google OAuth flow; password is MXmedia007 only if it was set via legacy flow — prefer the admin@fairway.com account for automated tests.

## Auth details
- JWT Bearer token stored as `fairway_token` in localStorage
- Token also accepted via `session_token` cookie (set on Google OAuth callback)
- Backend endpoint: POST /api/auth/login with `{email, password}` returns `{token, user}`
