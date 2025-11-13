# Quicklist-Claude

![CI Status](https://github.com/deannewton/Quicklist-Claude/workflows/CI/badge.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI-powered listing generator for online marketplaces (eBay, Vinted, Gumtree). Upload product photos and generate complete listings using Google Gemini Vision API, with automated market research, pricing intelligence, and optional eBay integration.

## Features

- **AI-Powered Generation**: Uses Google Gemini Vision to analyze product photos and generate comprehensive listings
- **Multi-Platform Support**: Create listings for eBay, Vinted, and Gumtree
- **Market Research**: Automatic online research with source citations
- **Pricing Intelligence**: AI-powered pricing recommendations based on market data
- **eBay Integration**: Direct posting to eBay with OAuth authentication
- **User Authentication**: Secure auth with Clerk (OAuth, MFA) and JWT fallback
- **Subscription Tiers**: Free and paid plans with Stripe integration
- **PWA Support**: Progressive Web App with offline capabilities
- **Dark Mode UI**: Modern, responsive design with indigo accents

## Tech Stack

- **Frontend**: Vanilla JavaScript (single-file architecture)
- **Backend**: Express.js with Node.js
- **Database**: PostgreSQL (Neon recommended)
- **AI**: Google Gemini Vision API (`gemini-2.0-flash-exp`)
- **Auth**: Clerk + JWT hybrid
- **Payments**: Stripe
- **Marketplace**: eBay API
- **Deployment**: Vercel serverless

## Quick Start

### Prerequisites

- Node.js 18+ or 20+
- PostgreSQL database (Neon recommended)
- Google Gemini API key
- Clerk account (for auth)

### Installation

```bash
# Clone the repository
git clone https://github.com/deannewton/Quicklist-Claude.git
cd Quicklist-Claude

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
# Required: DATABASE_URL, GEMINI_API_KEY, JWT_SECRET, CLERK_SECRET_KEY
nano .env

# Start development server
npm run dev
```

### Database Setup

1. Start the server: `npm run dev`
2. Visit: `http://localhost:4577/api/init-db`
3. Database tables will be created automatically

Note: In production, set `ALLOW_DB_INIT=true` to enable the init endpoint (use carefully).

## Development

```bash
# Start development server with auto-reload
npm run dev

# Run linting
npm run lint

# Run formatting check
npm run format:check

# Auto-fix formatting
npm run format

# Security audit
npm audit
```

## Deployment

This project is configured for Vercel deployment:

```bash
# Deploy to Vercel
vercel

# Or push to main branch for automatic deployment
git push origin main
```

### Environment Variables

Set these in your Vercel dashboard:

**Required:**

- `DATABASE_URL` - PostgreSQL connection string
- `GEMINI_API_KEY` - Google Gemini API key
- `JWT_SECRET` - 32+ character secret
- `CLERK_SECRET_KEY` - Clerk secret key
- `NODE_ENV` - Set to `production`
- `FRONTEND_URL` - Your production URL

**Optional:**

- `STRIPE_SECRET_KEY` - For subscription payments
- `EBAY_APP_ID`, `EBAY_DEV_ID`, `EBAY_CERT_ID` - For eBay integration
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - For Google OAuth

See `.env.example` for complete list.

## Project Structure

```
Quicklist-Claude/
├── .github/
│   ├── workflows/
│   │   └── ci.yml              # CI/CD pipeline
│   └── dependabot.yml          # Dependency updates
├── api/
│   ├── health.js               # Health check endpoint
│   └── server.js               # Vercel serverless wrapper
├── public/                     # Static assets
├── scripts/                    # Utility scripts
├── index.html                  # Single-file frontend (~5600 lines)
├── server.js                   # Express backend (~2800 lines)
├── schema.sql                  # Database schema
├── package.json                # Dependencies and scripts
├── vercel.json                 # Vercel configuration
├── CLAUDE.md                   # Architecture documentation
├── CONTRIBUTING.md             # Contribution guidelines
└── README.md                   # This file
```

## Architecture

### Single-File Frontend

The entire frontend is in `index.html` for simplicity:

- No build process required
- Instant changes on refresh
- Suitable for MVP/prototype
- ~5600 lines: HTML + CSS + JavaScript

### Backend API

Express.js server with:

- RESTful API endpoints
- JWT + Clerk authentication
- PostgreSQL with connection pooling
- Rate limiting and security headers
- Request ID tracking

### Database

PostgreSQL with three main tables:

- `users` - User accounts and auth
- `listings` - Generated product listings
- `images` - Base64 encoded product photos

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

- Development workflow
- Code quality standards
- Branch protection rules
- CI/CD pipeline
- Security best practices

### Quality Checks

All pull requests must pass:

- ESLint code quality checks
- Prettier formatting checks
- Security audit (moderate+ vulnerabilities blocked)
- Dependency verification
- Build verification

## Security

- Passwords hashed with bcryptjs
- Parameterized SQL queries (SQL injection protection)
- CORS whitelist
- Rate limiting on sensitive endpoints
- Helmet.js security headers
- Input sanitization

**Before production:**

- Generate new `JWT_SECRET` (32+ chars)
- Restrict `/api/init-db` endpoint
- Review CORS origins
- Enable monitoring/alerting
- Implement CSRF protection

## Documentation

- [CLAUDE.md](CLAUDE.md) - Complete architecture guide
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API reference
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [QUICK_START.md](QUICK_START.md) - Getting started

## License

MIT License - see LICENSE file for details

## Support

- Documentation: See `/docs` folder
- Issues: [GitHub Issues](https://github.com/deannewton/Quicklist-Claude/issues)
- Contact: @deannewton

---

**Status**: Active Development | Phase 1 - Production Readiness in Progress

Built with Claude Code by Anthropic
