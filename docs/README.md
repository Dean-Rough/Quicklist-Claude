# QuickList AI

> Turn your clutter into cash without the soul-crushing effort of writing a listing.

QuickList AI is a sophisticated, AI-powered web application that helps users quickly create high-quality product listings for online marketplaces like Vinted, eBay, and Gumtree. Simply snap a photo, and let AI do the rest.

## Features

### 🤖 AI-Powered Listing Generation

- Analyzes product images using Google Gemini Vision API
- Generates compelling, keyword-rich titles
- Identifies brands and categories automatically
- Creates detailed, honest descriptions
- Suggests competitive pricing based on market data
- Extracts relevant keywords and hashtags

### 📸 Smart Image Processing

- Automatic blur detection
- Multi-image upload support
- Camera integration for mobile devices
- Hero image generation
- Image enhancement capabilities

### 💾 Data Persistence

- PostgreSQL database integration
- User authentication via Clerk
- Secure password hashing with bcryptjs
- Save and manage multiple listings
- Cross-device access to your data

### 🎨 Modern UI/UX

- Dark mode aesthetic with indigo accents
- Responsive design for all devices
- Skeleton loading states
- Toast notifications
- Multi-column layout for efficient workflow

## Tech Stack

### Frontend

- Single-page HTML application
- Vanilla JavaScript (no frameworks)
- CSS3 with custom properties
- JSZip for download functionality
- Outfit font family from Google Fonts

### Backend

- Node.js with Express
- PostgreSQL (Neon Database)
- Clerk authentication
- Google Gemini Vision API
- bcryptjs for password hashing

## Installation

### Prerequisites

- Node.js 16+ installed
- PostgreSQL database (Neon or local)
- Google Gemini API key

### Setup

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd Quicklist-Claude
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example environment file and add your credentials:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` with your actual values:

   ```env
   DATABASE_URL=your_postgresql_connection_string
   GEMINI_API_KEY=your_gemini_api_key
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   PORT=3000
   ```

4. **Initialize the database**

   Start the server first, then visit:

   ```
   http://localhost:3000/api/init-db
   ```

   This will create all necessary tables and indexes.

5. **Start the server**

   ```bash
   npm start
   ```

   For development with auto-reload:

   ```bash
   npm run dev
   ```

6. **Open the application**

   Navigate to:

   ```
   http://localhost:3000
   ```

## Usage

### Getting Started

1. **Sign Up / Sign In**
   - Click "Sign In / Sign Up" button
   - Enter your email and password
   - New users are automatically registered

2. **Upload Product Photos**
   - Click the upload area or drag & drop images
   - Use your device camera for quick captures
   - Upload multiple images for batch processing

3. **Generate Listing**
   - Select your target platform (Vinted, eBay, or Gumtree)
   - Optionally add a hint about the item
   - Click "Generate Single Listing"
   - AI analyzes your image and creates a complete listing

4. **Review & Edit**
   - Review all generated fields
   - Edit any information as needed
   - Copy individual fields or all content
   - Regenerate keywords if desired

5. **Save & Download**
   - Save listings to your account for later
   - Download a ZIP file with all assets
   - ZIP includes listing text, images, and optional hero image

### Managing Listings

- **Saved Items**: View all your saved listings
- **Load**: Reload a saved listing to edit or update
- **Delete**: Remove listings you no longer need

### Settings

- **Auto-Download ZIP**: Automatically download ZIP after generation

## API Endpoints

### Authentication

- `GET /api/config/auth` - Fetch Clerk publishable key/flags
- `GET /api/auth/verify` - Validate Clerk session token

### Listings

- `GET /api/listings` - Get all user's listings
- `GET /api/listings/:id` - Get specific listing
- `POST /api/listings` - Create new listing
- `PUT /api/listings/:id` - Update listing
- `DELETE /api/listings/:id` - Delete listing

### AI Generation

- `POST /api/generate` - Generate listing from image

### Utilities

- `GET /api/health` - Health check
- `GET /api/init-db` - Initialize database schema

## Database Schema

### Users Table

- `id` - Primary key
- `email` - Unique email address
- `password_hash` - Hashed password
- `created_at` - Registration timestamp
- `updated_at` - Last update timestamp

### Listings Table

- `id` - Primary key
- `user_id` - Foreign key to users
- `title` - Listing title
- `brand` - Product brand
- `category` - Product category
- `description` - Detailed description
- `condition` - Item condition
- `rrp` - Retail price
- `price` - Suggested listing price
- `keywords` - Array of keywords
- `sources` - JSON array of research sources
- `platform` - Target marketplace
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### Images Table

- `id` - Primary key
- `listing_id` - Foreign key to listings
- `image_data` - Base64 encoded image
- `image_order` - Display order
- `is_blurry` - Blur detection flag
- `created_at` - Upload timestamp

## Security

- ✅ Clerk session verification on the backend
- ✅ SQL injection prevention with parameterized queries
- ✅ Environment variables for sensitive data
- ✅ CORS protection
- ⚠️ **Important**: Keep your Clerk keys, Stripe secrets, and AI API keys out of source control.

## Development

### Project Structure

```
Quicklist-Claude/
├── index.html          # Frontend application
├── server.js           # Backend API server
├── schema.sql          # Database schema
├── package.json        # Dependencies
├── .env               # Environment variables
├── .gitignore         # Git ignore rules
└── README.md          # This file
```

### Adding Features

The application is designed to be easily extensible:

- **Frontend**: Edit `index.html`, all JavaScript is in the `<script>` section
- **Backend**: Edit `server.js` to add new API endpoints
- **Database**: Modify `schema.sql` and re-run `/api/init-db`

## Testing

1. Ensure `.env` contains `CLERK_SECRET_KEY` and either `CLERK_FRONTEND_API` or `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
2. Generate a temporary Clerk session token (automated):

   ```bash
   npm run clerk:token
   ```

   - Optional: set `CLERK_TEST_USER_EMAIL` to reuse a deterministic test user.

3. Run the end-to-end smoke script (will auto-generate the token if missing):
   ```bash
   ./e2e_test.sh
   ```
   The script verifies auth, listing CRUD, and cleanup using the generated token.

## Troubleshooting

### Database Connection Issues

- Verify your `DATABASE_URL` in `.env`
- Check if the Neon database is accessible
- Ensure SSL is properly configured

### API Key Issues

- Verify `GEMINI_API_KEY` is correct
- Check API quota limits
- Review Gemini API console for errors

### Authentication Issues

- Clear browser localStorage
- Check browser console for error messages
- Verify Clerk publishable + secret keys are configured

## Future Enhancements

- [ ] Batch processing for multiple items
- [ ] Advanced image editing tools
- [ ] Price history tracking
- [ ] Marketplace API integrations
- [ ] Mobile app versions
- [ ] AI-powered photo enhancement
- [ ] Automated cross-posting

## License

All rights reserved © 2025 QuickList AI

## Support

For issues and feature requests, please contact the development team.

---

**Built with ❤️ for sellers who hate writing descriptions**
