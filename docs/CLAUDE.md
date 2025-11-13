# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QuickList AI is an AI-powered listing generator for online marketplaces (Vinted, eBay, Gumtree). Users upload product photos and the app generates complete listings using Google Gemini Vision API.

**Key Architecture Decision**: Single-file frontend (`index.html` - 2382 lines) with no build process. All HTML, CSS, and JavaScript are in one file for simplicity and zero build complexity.

## Development Commands

```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Initialize database (one-time setup, or after schema changes)
# Start server first, then visit: http://localhost:4577/api/init-db
```

**Port Configuration**: The app runs on port 4577 (configured in `.env.local`).

## Tech Stack

- **Frontend**: Vanilla JavaScript (no framework), single HTML file, JSZip for downloads
- **Backend**: Express.js with Node.js
- **Database**: PostgreSQL (Neon - serverless/cloud-hosted)
- **Authentication**: JWT tokens (7-day expiry) + bcryptjs password hashing
- **AI**: Google Gemini Vision API (`gemini-2.0-flash-exp` model)

## Architecture

### Single-File Frontend Structure

All code is in `index.html`:
- **Lines 1-9**: HTML structure and meta tags
- **Lines 10-881**: Embedded CSS (dark mode design with indigo accents)
- **Lines 882-1479**: HTML markup (marketing pages + app views)
- **Lines 1480-2382**: JavaScript application logic

**State Management**: Global `app` object with centralized state:
```javascript
app.state = {
    isAuthenticated: false,
    user: null,
    token: null,
    currentView: 'home',           // Marketing navigation
    currentAppView: 'newItem',     // App navigation
    uploadedImages: [],
    currentListing: null,
    savedListings: [],
    settings: { autoDownloadZip: false }
}
```

### Backend API Structure (`server.js`)

**Route Categories**:
1. **Auth**: `/api/auth/signup`, `/api/auth/signin`, `/api/auth/verify`
2. **Listings CRUD**: `/api/listings` (GET/POST), `/api/listings/:id` (GET/PUT/DELETE)
3. **AI Generation**: `/api/generate` (receives image + platform, returns listing)
4. **Utilities**: `/api/health`, `/api/init-db`

**Authentication Flow**: JWT tokens stored in `localStorage`, sent as `Authorization: Bearer <token>` header. Middleware `authenticateToken()` protects routes.

### Database Schema

**Three tables** (see `schema.sql`):
1. **users**: id, email, password_hash, timestamps
2. **listings**: user_id, title, brand, category, description, condition, rrp, price, **keywords (TEXT[])**, **sources (JSONB)**, platform, timestamps
3. **images**: listing_id, image_data (base64), image_order, is_blurry, timestamp

**Important**:
- Keywords stored as PostgreSQL array (`TEXT[]`)
- Sources stored as JSONB for flexible structure
- Images stored as base64 strings (not filesystem/blob)
- Cascade delete: deleting user deletes listings → deleting listing deletes images

## Key Workflows

### AI Generation Flow

1. User uploads images → converted to base64 → stored in `app.state.uploadedImages[]`
2. User clicks "Generate" → `app.generateListing()` called
3. POST to `/api/generate` with `{image, platform, hint}`
4. Backend calls Gemini Vision API with prompt tailored to platform
5. Response parsed and returned to frontend
6. `app.displayListing()` populates editable form fields
7. User can edit, save to DB, or download as ZIP

**Gemini Prompt Structure**: The prompt in `server.js` line ~200 instructs the AI to:
- Analyze the image and generate title, brand, category, description, condition
- Research similar items online and provide `rrp` (retail price) and competitive `price`
- Extract keywords and provide `sources` (array of URLs used for research)
- Return JSON matching the listing schema

### Save Listing Flow

1. `app.saveListing()` → POST `/api/listings` with listing data + images
2. Backend inserts into `listings` table, gets `listing_id`
3. Backend loops through images, inserting each into `images` table with `listing_id`
4. Returns saved listing with id to frontend

## File Editing Guidelines

### When editing `index.html`:

**CSS (Lines 10-881)**:
- Uses CSS custom properties (variables) defined in `:root` selector
- Dark mode color scheme: `--bg-primary: #0f0f23`, `--indigo-500: #6366f1`
- Responsive breakpoints handled with media queries

**JavaScript (Lines 1480-2382)**:
- All code is in single `app` object namespace
- Async/await used throughout (no callbacks/promises)
- Key methods:
  - `init()`: Initialize app on DOMContentLoaded
  - `generateListing()`: Main AI generation workflow
  - `saveListing()`, `loadListing()`, `deleteListing()`: CRUD operations
  - `updateUI()`: Toggle between marketing/app views based on auth state
  - `displayListing()`: Populate form from listing data
  - `downloadZip()`: Generate ZIP file with JSZip

**When adding new features**:
- Add CSS in the `<style>` block (lines 10-881)
- Add HTML markup in appropriate section (marketing vs app)
- Add JavaScript methods to `app` object
- Follow existing patterns (async/await, state management in `app.state`)

### When editing `server.js`:

- **Database queries**: Always use parameterized queries (`$1, $2`) to prevent SQL injection
- **Protected routes**: Add `authenticateToken` middleware before handler
- **Error handling**: Return appropriate HTTP status codes (400, 401, 404, 500)
- **CORS**: Already configured, no changes needed for localhost development

### When editing `schema.sql`:

- After changes, drop existing tables and re-run `/api/init-db` endpoint
- **Caution**: This deletes all data. For production, write migration scripts instead
- Remember to add indexes for foreign keys and frequently queried columns

## Environment Variables

Required in `.env` or `.env.local`:
```env
DATABASE_URL=postgresql://... (Neon database connection string)
GEMINI_API_KEY=... (Google AI Studio)
JWT_SECRET=... (secure random string, change for production!)
PORT=4577
```

## Testing

**No automated test suite** - manual E2E testing documented in `E2E_TEST_REPORT.md`.

**Testing approach**:
1. Start server: `npm run dev`
2. Test endpoints with curl/Postman
3. Manual UI testing in browser
4. Check console for errors

**Common test scenarios**:
- Sign up → generate listing → save → load from saved items → delete
- Upload multiple images → blur detection → ZIP download
- Copy individual fields vs copy all
- Settings persistence in localStorage

## Security Notes

- **SECURITY_INCIDENT.md** documents a past incident where API keys were committed to git
- **Current security measures**:
  - All secrets in `.env` (gitignored)
  - Password hashing with bcryptjs (10 rounds)
  - Parameterized SQL queries
  - JWT with 7-day expiration
  - CORS enabled

**Before deployment**:
- Generate new `JWT_SECRET` (use `require('crypto').randomBytes(64).toString('hex')`)
- Ensure `.env` is never committed
- Review CORS origins (currently allows all)

## Common Gotchas

1. **Single HTML file**: All frontend code is in `index.html`. Don't create separate JS/CSS files unless refactoring the architecture.

2. **Base64 images**: Images are stored as base64 strings in the database. Large image uploads can hit the 50MB JSON body limit (configured in `server.js`).

3. **No build step**: Changes to `index.html` are reflected immediately on browser refresh. No webpack/bundler.

4. **Database initialization**: Visit `/api/init-db` after any schema changes. This drops and recreates all tables.

5. **Authentication persistence**: JWT stored in `localStorage` with key `quicklist-token`. Clear localStorage to sign out.

6. **Port must match**: Frontend `app.apiUrl` (line ~1483) should match backend `PORT` in `.env`. Currently hardcoded to `http://localhost:3000` but should be `http://localhost:4577`.

7. **PostgreSQL arrays**: When querying/inserting keywords, use PostgreSQL array syntax: `ARRAY['keyword1', 'keyword2']` or `$1::text[]`.

## Future Enhancement Ideas (from README)

- Batch processing for multiple items
- Advanced image editing tools
- Marketplace API integrations (auto-post to Vinted/eBay)
- Automated testing suite (Jest/Mocha)
- Code splitting (separate HTML/CSS/JS files)
- Image compression before storage
- Rate limiting on API endpoints
- Pagination for saved listings
