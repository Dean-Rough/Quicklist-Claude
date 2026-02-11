# Quicklist Production Readiness Test Checklist
**Created:** 2026-02-10  
**Purpose:** Comprehensive validation before launch

---

## Pre-Test Setup

### Environment Configuration
- [ ] Verify all required environment variables are set in Vercel
  - [ ] `DATABASE_URL`
  - [ ] `GEMINI_API_KEY`
  - [ ] `CLERK_SECRET_KEY`
  - [ ] `CLERK_PUBLISHABLE_KEY`
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_PUBLISHABLE_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `STRIPE_PRICE_STARTER` (or CASUAL)
  - [ ] `STRIPE_PRICE_PRO`
  - [ ] `STRIPE_PRICE_BUSINESS` (or MAX)
  - [ ] `CLOUDINARY_CLOUD_NAME`
  - [ ] `CLOUDINARY_API_KEY`
  - [ ] `CLOUDINARY_API_SECRET`
  - [ ] `FRONTEND_URL=https://quicklist.it.com`
  - [ ] `NODE_ENV=production`

### Clerk Configuration
- [ ] Sign-ups enabled in Clerk Dashboard
- [ ] Email/password authentication enabled
- [ ] OAuth providers configured (if applicable)
- [ ] Clerk webhook configured (if using)

### Stripe Configuration
- [ ] Products created in Stripe Dashboard
  - [ ] Starter/Casual: £19/month (or £4.99)
  - [ ] Pro: £39/month (or £9.99)
  - [ ] Business/Max: £69/month (or £19.99)
- [ ] Price IDs copied to environment variables
- [ ] Webhook endpoint configured: `https://quicklist.it.com/api/stripe/webhook`
- [ ] Webhook secret copied to `STRIPE_WEBHOOK_SECRET`
- [ ] Test mode enabled for initial testing

### Database
- [ ] Schema migrations applied
- [ ] Database accessible from Vercel
- [ ] Connection pooling working
- [ ] Sample data (optional) for testing dashboard

---

## Test Scenarios

### 1. Landing Page (Public - Not Logged In)

**URL:** `https://quicklist.it.com`

#### Visual & SEO
- [ ] Page loads without errors
- [ ] Logo and branding visible
- [ ] Typography renders correctly (Manrope + Space Grotesk)
- [ ] Color scheme looks professional (teal + cream)
- [ ] Hero section visible with clear value proposition
- [ ] CTA buttons clearly visible
- [ ] Mobile responsive (test on phone or DevTools)
- [ ] OG image loads for social sharing (test with Facebook Debugger / Twitter Card Validator)
- [ ] Favicon visible in browser tab

#### Content
- [ ] Headline: "Turn Your Clutter Into Cash with AI" (or similar)
- [ ] Clear description of service
- [ ] Pricing tiers visible on pricing section
  - [ ] Free tier: 5 listings/month
  - [ ] Paid tier 1: 50 listings (£19 or £4.99)
  - [ ] Paid tier 2: 200 listings (£39 or £9.99)
  - [ ] Paid tier 3: Unlimited (£69 or £19.99)
- [ ] Feature list makes sense
- [ ] No placeholder text or "Lorem ipsum"
- [ ] No broken images

#### Navigation
- [ ] "Sign In" button works → redirects to Clerk
- [ ] "Get Started" button works → redirects to Clerk signup
- [ ] Pricing link scrolls to pricing section (or opens modal)
- [ ] All menu items work
- [ ] Footer links work (if applicable)

#### Performance
- [ ] Page loads in < 3 seconds
- [ ] No console errors in DevTools
- [ ] No 404s in Network tab
- [ ] Google Fonts load correctly
- [ ] PWA installable (check "Add to Home Screen" prompt)

---

### 2. Sign Up Flow (New User)

**Start:** Click "Get Started" or "Sign In"

#### Clerk Sign Up
- [ ] Clerk signup modal/page opens
- [ ] Email + password fields visible
- [ ] Can enter email address
- [ ] Can enter password
- [ ] Password requirements shown (if applicable)
- [ ] "Sign up" button works
- [ ] Email verification sent (check email)
- [ ] Can verify email (click link)
- [ ] After verification, redirected to app

#### Post-Signup Experience
- [ ] Lands on app view (not landing page)
- [ ] User menu/avatar visible in header
- [ ] Welcome toast/message shown
- [ ] Dashboard or "New Item" view visible
- [ ] No errors in console

#### Database Verification
- [ ] New user record created in `users` table
  - [ ] `clerk_id` populated
  - [ ] `email` matches signup
  - [ ] `auth_provider = 'clerk'`
  - [ ] `created_at` timestamp correct
- [ ] No duplicate users created

---

### 3. Sign In Flow (Existing User)

**Start:** Click "Sign In"

#### Clerk Sign In
- [ ] Clerk sign-in modal/page opens
- [ ] Email + password fields visible
- [ ] Can enter credentials
- [ ] "Sign in" button works
- [ ] After signin, redirected to app
- [ ] User session persists on page reload

#### Session Persistence
- [ ] Reload page → still signed in
- [ ] Close tab, reopen → still signed in (if "Remember me" checked)
- [ ] User avatar/menu visible
- [ ] User name/email displayed correctly

---

### 4. Dashboard View

**Prerequisites:** Signed in with account that has some listings

#### Metrics Display
- [ ] Dashboard view loads
- [ ] Metrics cards visible:
  - [ ] "Revenue Last 7 Days" (shows £0.00 or actual revenue)
  - [ ] "Active Listings" (shows count)
  - [ ] "Listings Added Today" (shows count)
  - [ ] "Unread Messages" (shows 0 or count)
- [ ] Revenue trend shows percentage (up/down arrow)
- [ ] Activity feed shows:
  - [ ] "Queued photos" (count)
  - [ ] "Draft listings" (count)
  - [ ] "Sold this week" (count)
- [ ] Tips/hints displayed at bottom

#### Data Accuracy
- [ ] Metrics match actual database state (not fake data)
- [ ] Create a listing → "Listings Added Today" increments
- [ ] Mark listing as sold → "Sold this week" increments
- [ ] Revenue calculates correctly from sold prices

#### Navigation
- [ ] Click "New Item" → navigates to upload view
- [ ] Click "Saved Items" → navigates to listings view
- [ ] Click "Settings" → navigates to settings view

---

### 5. Upload Photos Flow

**Start:** Dashboard → "New Item" or "📷 New" in bottom nav

#### Desktop Upload
- [ ] Upload area visible with drag-and-drop zone
- [ ] Click "Choose files" → file picker opens
- [ ] Select 1 image → uploads successfully
- [ ] Thumbnail appears
- [ ] Upload progress indicator shown
- [ ] Can upload multiple images (2-5)
- [ ] Can reorder images (drag handles)
- [ ] Can delete uploaded image (X button)

#### Mobile Upload
- [ ] "Take Photo" button visible
- [ ] Click "Take Photo" → camera opens
- [ ] Can capture photo
- [ ] Photo appears in upload area
- [ ] "Choose from Gallery" button works
- [ ] Can select from photo library

#### Image Quality
- [ ] Blur detection works
  - [ ] Upload blurry image → warning shown
  - [ ] "Image may be blurry" badge visible
- [ ] Image preview loads correctly
- [ ] Images display at reasonable size (not huge or tiny)

#### Cloudinary Integration
- [ ] Images uploaded to Cloudinary (check Network tab for `cloudinary.com` requests)
- [ ] Cloudinary URLs returned to frontend
- [ ] Images persist on page reload

#### Validation
- [ ] Can't proceed to generation with 0 images
- [ ] "Generate Listing" button disabled until images uploaded
- [ ] Error message if upload fails

---

### 6. AI Listing Generation

**Prerequisites:** At least 1 photo uploaded

#### Input Form
- [ ] Platform selector visible (Vinted / eBay / Gumtree)
- [ ] Can select platform
- [ ] "Item Name" field (optional)
- [ ] "Further Info" field (optional, textarea)
- [ ] "Condition Info" field (optional)
- [ ] Personality dropdown (Basic / Casual / Pro / Max)
  - [ ] Free users see "Basic" only
  - [ ] Paid users see premium personalities
  - [ ] Premium personalities show "(Pro only)" for free users
- [ ] "Generate Listing" button enabled when photos uploaded

#### Generation Process
- [ ] Click "Generate Listing" → generation starts
- [ ] Loading indicator shown
- [ ] Progress steps visible:
  - [ ] "Analyzing images..."
  - [ ] "Detecting product codes..."
  - [ ] "Researching market data..."
  - [ ] "Writing description..."
- [ ] Each step shows status (spinner or checkmark)
- [ ] "Cancel" button visible and works
- [ ] Estimated time shown (optional)

#### Generation Results (Success)
- [ ] Generation completes in < 60 seconds
- [ ] Results screen shows:
  - [ ] **Title** (populated, makes sense)
  - [ ] **Brand** (detected correctly or blank)
  - [ ] **Category** (detected correctly or blank)
  - [ ] **Description** (coherent, relevant, professional tone)
  - [ ] **Condition** (e.g., "Good", "Like New", "Fair")
  - [ ] **RRP** (original retail price, if detected)
  - [ ] **Suggested Price** (in GBP, reasonable)
  - [ ] **Keywords** (array of relevant tags)
  - [ ] **Sources** (clickable links to research)
- [ ] All fields editable
- [ ] Images displayed as gallery

#### AI Quality Check
- [ ] Title is relevant to uploaded photos
- [ ] Description mentions actual product features visible in photos
- [ ] No hallucinated details (making up specs not visible)
- [ ] Pricing is reasonable (not £0.01 or £999,999)
- [ ] Keywords are relevant
- [ ] Sources are real URLs (not broken links)

#### Platform-Specific Variations
- [ ] Select "eBay" → description optimized for eBay
- [ ] Select "Vinted" → description casual/friendly
- [ ] Select "Gumtree" → description local/pragmatic

#### Error Handling
- [ ] If generation fails → error message shown
- [ ] "Retry" button available
- [ ] Can cancel and return to upload
- [ ] No infinite loading states

---

### 7. Listing Review & Edit

**Prerequisites:** Successfully generated listing

#### Editing
- [ ] Can edit title
- [ ] Can edit description
- [ ] Can edit price
- [ ] Can edit condition
- [ ] Can edit keywords (add/remove)
- [ ] Changes save locally (persist on page refresh)

#### Image Management
- [ ] Can reorder images (set hero image)
- [ ] Can delete images
- [ ] Can add more images after generation
- [ ] Hero image (first image) clearly indicated

#### Platform Selector (Post-Generation)
- [ ] Platform selector visible
- [ ] Can switch platform
- [ ] Switching platform updates description tone (optional, advanced feature)

---

### 8. Export Functionality

**Prerequisites:** Generated listing ready

#### Download ZIP
- [ ] "Download ZIP" button visible
- [ ] Click button → ZIP file downloads
- [ ] ZIP contains:
  - [ ] `listing.txt` or `listing.json` with all text data
  - [ ] All uploaded images (as JPG or PNG)
  - [ ] Filenames are sensible (not random hashes)
- [ ] ZIP file size reasonable (< 10MB for typical listing)

#### Copy to Clipboard
- [ ] "Copy" buttons visible for:
  - [ ] Title
  - [ ] Description
  - [ ] Full listing
- [ ] Click "Copy" → text copied to clipboard
- [ ] Paste into notepad → text matches what's displayed
- [ ] Success toast shown: "Copied to clipboard"

#### Export to Platform (Future)
- [ ] "Post to eBay" button visible (if eBay integration enabled)
- [ ] Click button → (OAuth flow or direct posting)
- [ ] Success/error message shown

---

### 9. Saved Listings Management

**Prerequisites:** Signed in user with saved listings

#### Listings View
- [ ] Navigate to "Saved Items" → listings grid visible
- [ ] Each listing card shows:
  - [ ] Thumbnail (first image)
  - [ ] Title
  - [ ] Price
  - [ ] Status badge (Draft / Active / Sold)
  - [ ] Created date
- [ ] Listings sorted by most recent first
- [ ] Can see at least 10 listings (pagination if more)

#### Search & Filter
- [ ] Search bar visible
- [ ] Type in search → filters listings by title
- [ ] Search is case-insensitive
- [ ] Filter by status (Draft / Active / Sold)
- [ ] Filter by platform (Vinted / eBay / Gumtree)

#### Listing Actions
- [ ] Click listing card → opens detail view
- [ ] Edit button → can modify listing
- [ ] Delete button → confirmation modal shown
- [ ] Confirm delete → listing removed from database
- [ ] "Mark as Sold" button → status changes to "Sold"
  - [ ] Sold listings show "Sold" badge
  - [ ] Sold listings ask for sale price
  - [ ] Sale price updates dashboard revenue

#### Pagination
- [ ] If > 20 listings, pagination controls visible
- [ ] "Next" button loads next page
- [ ] "Previous" button loads previous page
- [ ] Page numbers shown

---

### 10. Settings View

**Prerequisites:** Signed in user

#### Account Information
- [ ] Settings view loads
- [ ] User name displayed
- [ ] User email displayed
- [ ] Account creation date shown (optional)

#### Subscription Status
- [ ] Current plan displayed:
  - [ ] "Free" (if no subscription)
  - [ ] "Starter" / "Pro" / "Business" (if paid)
- [ ] Listings used this month shown
- [ ] Listings limit shown (e.g., "3 / 5 used")
- [ ] Progress bar or usage indicator

#### Upgrade Section
- [ ] "Upgrade" button visible (if on free plan)
- [ ] Click "Upgrade" → pricing modal opens (see Test #11)
- [ ] If on paid plan:
  - [ ] "Manage Subscription" button visible
  - [ ] Click → redirects to Stripe Customer Portal

#### Preferences
- [ ] Auto-download ZIP toggle
- [ ] Toggle works (saves setting)
- [ ] Setting persists on reload
- [ ] Other preferences (if applicable)

#### Sign Out
- [ ] "Sign Out" button visible
- [ ] Click → signs out user
- [ ] Redirected to landing page
- [ ] Session cleared (can't access app without signin)

---

### 11. Upgrade Flow (Critical)

**Prerequisites:** Signed in on free plan

#### Pricing Modal
- [ ] Click "Upgrade" button → modal opens
- [ ] Modal shows 3 pricing tiers:
  - [ ] Tier 1: £19/month (or £4.99), 50 listings
  - [ ] Tier 2: £39/month (or £9.99), 200 listings
  - [ ] Tier 3: £69/month (or £19.99), unlimited
- [ ] Each tier shows:
  - [ ] Name (Starter / Pro / Business)
  - [ ] Price
  - [ ] Features list
  - [ ] "Upgrade to [Plan]" button
- [ ] Featured plan highlighted (e.g., Pro with border)
- [ ] Current plan shows "Current Plan" badge (if any)
- [ ] Can close modal (X button or click outside)

#### Stripe Checkout
- [ ] Click "Upgrade to Pro" → redirects to Stripe Checkout
- [ ] Stripe Checkout page loads
- [ ] Shows correct plan name and price
- [ ] Can enter test card: `4242 4242 4242 4242`
- [ ] Expiry: any future date (e.g., 12/34)
- [ ] CVC: any 3 digits (e.g., 123)
- [ ] Click "Subscribe" → payment processes

#### Post-Checkout
- [ ] After payment → redirected back to `quicklist.it.com`
- [ ] Success message shown: "Welcome to [Plan]!"
- [ ] Settings page shows new plan
- [ ] Listing limit updated (e.g., 5 → 50)
- [ ] Dashboard shows updated usage

#### Database Verification
- [ ] New record in `subscriptions` table:
  - [ ] `user_id` matches
  - [ ] `stripe_customer_id` populated
  - [ ] `stripe_subscription_id` populated
  - [ ] `stripe_price_id` matches selected plan
  - [ ] `status = 'active'`
  - [ ] `plan_type` matches selected plan
  - [ ] `current_period_end` set correctly

#### Error Cases
- [ ] If Stripe price IDs not configured:
  - [ ] Error message: "Payment system is being configured"
  - [ ] Does NOT crash or show blank modal
- [ ] If payment fails:
  - [ ] Error message shown
  - [ ] User returned to app (not stuck on Stripe)
  - [ ] No subscription created in database

---

### 12. Stripe Webhook Handling

**Prerequisites:** Paid subscription created

#### Webhook Events to Test
- [ ] **Subscription created** (`checkout.session.completed`)
  - [ ] Subscription record created in database
  - [ ] User plan updated
  - [ ] Usage limit updated
- [ ] **Payment succeeded** (`invoice.payment_succeeded`)
  - [ ] Subscription status remains `active`
  - [ ] Period end date updated
- [ ] **Payment failed** (`invoice.payment_failed`)
  - [ ] Subscription status updated to `past_due` or `unpaid`
  - [ ] User notified (optional)
- [ ] **Subscription updated** (e.g., upgrade from Pro to Business)
  - [ ] Plan type updated in database
  - [ ] Listing limit updated
- [ ] **Subscription canceled** (`customer.subscription.deleted`)
  - [ ] Subscription status updated to `canceled`
  - [ ] User downgraded to free plan
  - [ ] Listing limit reverts to 5

#### Webhook Verification
- [ ] Go to Stripe Dashboard → Webhooks
- [ ] Check webhook delivery logs
- [ ] All events show "Success" (200 status)
- [ ] No failed deliveries or retries
- [ ] Webhook signature validation working (no unauthorized events)

#### Manual Webhook Testing
- [ ] Use Stripe CLI: `stripe trigger checkout.session.completed`
- [ ] Verify database updated correctly
- [ ] Use Stripe Dashboard → "Send test webhook"
- [ ] Verify app handles gracefully

---

### 13. Usage Limits & Enforcement

**Prerequisites:** User on Free plan (5 listings/month)

#### Free Tier Limit
- [ ] Create 5 listings → all succeed
- [ ] Try to create 6th listing → blocked with error
- [ ] Error message: "You've reached your monthly limit of 5 listings"
- [ ] "Upgrade to Pro" prompt shown
- [ ] Clicking upgrade link → opens pricing modal

#### Paid Tier Limit
- [ ] Upgrade to Starter (50 listings)
- [ ] Usage counter shows "0 / 50 used"
- [ ] Create 1 listing → counter increments "1 / 50 used"
- [ ] Create 50 listings → can still create all
- [ ] Try to create 51st → blocked (if not unlimited tier)

#### Limit Reset
- [ ] Wait for billing period to end (or manually update database)
- [ ] Usage counter resets to 0
- [ ] Can create new listings again

#### Database Tracking
- [ ] `usage_tracking` table updated correctly
  - [ ] New row created for each billing period
  - [ ] `listings_created` increments with each generation
  - [ ] `period_start` and `period_end` set correctly

---

### 14. Mobile Responsiveness

**Test on:** iPhone (Safari), Android (Chrome), or Chrome DevTools mobile emulation

#### Layout
- [ ] Landing page looks good on mobile
- [ ] App interface usable on mobile
- [ ] No horizontal scrolling
- [ ] Buttons are tappable (not too small)
- [ ] Text readable without zooming

#### Bottom Navigation
- [ ] Bottom nav bar visible on mobile
- [ ] Icons clear and labeled
- [ ] Navigation works (Home / New / Saved / Settings)
- [ ] Active tab highlighted

#### Camera
- [ ] "Take Photo" button opens native camera
- [ ] Can capture photo
- [ ] Photo appears in upload area
- [ ] Camera permissions requested (if first time)

#### Forms
- [ ] Input fields usable on mobile keyboard
- [ ] Dropdowns work (platform selector, personality)
- [ ] No overlapping UI elements
- [ ] Modal dialogs fit on screen

---

### 15. PWA Installation

**Test on:** Chrome (desktop/mobile), Safari (iOS)

#### Desktop Installation
- [ ] Visit https://quicklist.it.com
- [ ] See "Install" icon in address bar (Chrome)
- [ ] Click install → app installs as standalone app
- [ ] App icon appears in Applications / Start Menu
- [ ] Launch app → opens in standalone window (no browser UI)
- [ ] App works identically to web version

#### Mobile Installation
- [ ] Visit on iPhone → see "Add to Home Screen" prompt
- [ ] Add to home screen → icon appears on home screen
- [ ] Launch app → opens fullscreen (no Safari UI)
- [ ] App icon matches branding
- [ ] Splash screen shown on launch (optional)

#### Offline Support
- [ ] Install PWA
- [ ] Go offline (airplane mode or disconnect WiFi)
- [ ] Launch app → loads offline page or cached content
- [ ] Can view previously generated listings
- [ ] Cannot generate new listings (requires API)
- [ ] Error message: "You're offline. Some features unavailable."

#### Service Worker
- [ ] Check DevTools → Application → Service Workers
- [ ] Service worker registered and active
- [ ] Cache storage populated with assets
- [ ] Updates when new version deployed

---

### 16. Performance Testing

#### Load Time
- [ ] Landing page loads in < 3 seconds (on 3G connection)
- [ ] App interface loads in < 2 seconds (after signin)
- [ ] Images load progressively (not blocking render)

#### Lighthouse Audit
- [ ] Open DevTools → Lighthouse
- [ ] Run audit (Performance, Accessibility, SEO, PWA)
- [ ] Scores:
  - [ ] Performance: > 80
  - [ ] Accessibility: > 90
  - [ ] SEO: > 90
  - [ ] PWA: > 80
- [ ] Fix critical issues flagged

#### API Performance
- [ ] Generate listing completes in < 30 seconds (typical case)
- [ ] Upload photo completes in < 5 seconds
- [ ] Load saved listings in < 2 seconds (for 50 listings)

#### Memory Leaks
- [ ] Generate 10 listings in a row → no browser slowdown
- [ ] Upload 50 images → no memory leak (check DevTools Memory)
- [ ] No console errors after extended use

---

### 17. Security Testing

#### Authentication
- [ ] Cannot access app routes without signin (redirect to login)
- [ ] Cannot access API endpoints without valid token (401 Unauthorized)
- [ ] JWT token expires after reasonable time (e.g., 1 hour)
- [ ] Refresh token works (if implemented)

#### Authorization
- [ ] User A cannot access User B's listings (via API)
- [ ] Try to fetch `/api/listings?userId=OTHER_USER_ID` → rejected
- [ ] Try to delete another user's listing → rejected

#### Input Sanitization
- [ ] Try XSS in title: `<script>alert('XSS')</script>`
  - [ ] Script not executed (sanitized)
  - [ ] Displayed as plain text
- [ ] Try SQL injection in search: `' OR 1=1 --`
  - [ ] No error
  - [ ] Query parameterized (safe)

#### HTTPS
- [ ] All requests use HTTPS (check DevTools Network tab)
- [ ] No mixed content warnings
- [ ] Cookies set with `Secure` flag
- [ ] CORS headers configured correctly

#### Rate Limiting
- [ ] Try generating 100 listings in 1 minute
  - [ ] Rate limit kicks in (429 Too Many Requests)
  - [ ] Error message shown
- [ ] Try uploading 1000 images rapidly
  - [ ] Rate limit enforced

---

### 18. Error Handling & Edge Cases

#### API Errors
- [ ] Gemini API fails → graceful error message (not crash)
- [ ] Database unreachable → error page (not blank screen)
- [ ] Cloudinary upload fails → retry option or clear error
- [ ] Stripe checkout fails → user returned to app with error

#### Network Issues
- [ ] Disconnect internet mid-generation → error shown
- [ ] Reconnect → can retry
- [ ] Slow connection → timeout after reasonable time (not infinite loading)

#### Invalid Input
- [ ] Upload non-image file (e.g., .txt) → error message
- [ ] Upload image > 10MB → error or resize
- [ ] Submit empty title → validation error
- [ ] Enter negative price → validation error

#### Browser Compatibility
- [ ] Test on Chrome (latest)
- [ ] Test on Firefox (latest)
- [ ] Test on Safari (latest)
- [ ] Test on Edge (latest)
- [ ] No major UI breaks or features broken

---

### 19. Accessibility Testing

#### Keyboard Navigation
- [ ] Can tab through all interactive elements
- [ ] Focus visible (outline or highlight)
- [ ] Can submit forms with Enter key
- [ ] Can close modals with Escape key
- [ ] Skip link works (jump to main content)

#### Screen Reader
- [ ] Use screen reader (macOS VoiceOver or NVDA on Windows)
- [ ] All images have alt text
- [ ] Form labels read correctly
- [ ] Button purposes clear
- [ ] ARIA labels present where needed
- [ ] No unlabeled interactive elements

#### Color Contrast
- [ ] Text readable against backgrounds (WCAG AA compliance)
- [ ] Links distinguishable from body text
- [ ] Buttons have sufficient contrast

#### Reduced Motion
- [ ] Enable "Reduce motion" in OS settings
- [ ] Animations reduced or disabled
- [ ] No disorienting motion

---

### 20. Cross-Browser Testing

#### Chrome
- [ ] All features work
- [ ] No console errors
- [ ] Performance acceptable

#### Firefox
- [ ] All features work
- [ ] Clerk signin works
- [ ] PWA installable
- [ ] No layout issues

#### Safari (macOS/iOS)
- [ ] All features work
- [ ] Camera works on iOS
- [ ] PWA installation works
- [ ] No iOS-specific bugs

#### Edge
- [ ] All features work
- [ ] Performance acceptable
- [ ] No Edge-specific issues

---

## Post-Testing Actions

### Bug Tracking
- [ ] Document all failed tests in GitHub Issues
- [ ] Prioritize: Critical (P0) → High (P1) → Medium (P2) → Low (P3)
- [ ] Assign blockers to immediate fix queue

### Performance Metrics
- [ ] Record baseline metrics (load time, API response time)
- [ ] Set up monitoring (Sentry, Vercel Analytics, or similar)
- [ ] Define acceptable thresholds

### User Acceptance
- [ ] Test with 3-5 beta users
- [ ] Gather feedback on UX
- [ ] Fix critical UX issues before launch

---

## Definition of "Done"

**All tests in sections 1-20 pass without critical failures.**

Critical failures:
- Cannot sign up
- Cannot sign in
- Cannot upload photos
- Cannot generate listing
- Cannot upgrade (Stripe checkout broken)
- Data loss (listings not saved)
- Security vulnerability (XSS, SQL injection)

---

**Test Checklist Complete**  
**Next:** Run tests, document failures, begin Fix Loop (Phase 3)
