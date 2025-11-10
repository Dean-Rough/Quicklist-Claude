const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
let pool;
if (process.env.DATABASE_URL && process.env.DATABASE_URL !== 'postgresql://placeholder:placeholder@placeholder.neon.tech/quicklist?sslmode=require') {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    // Test database connection
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('⚠️  Database connection error:', err);
        } else {
            console.log('✅ Database connected successfully');
        }
    });
} else {
    console.log('⚠️  No valid DATABASE_URL found. Running without database. Please update .env with your Neon database URL.');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.')); // Serve static files from current directory

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Initialize database schema
app.get('/api/init-db', async (req, res) => {
    try {
        const fs = require('fs');
        const schema = fs.readFileSync('schema.sql', 'utf8');
        await pool.query(schema);
        res.json({ message: 'Database initialized successfully' });
    } catch (error) {
        console.error('Database initialization error:', error);
        res.status(500).json({ error: 'Failed to initialize database' });
    }
});

// Auth endpoints
app.post('/api/auth/signup', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({
                error: 'Database not configured. Please update DATABASE_URL in .env with your Neon database connection string.'
            });
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Check if user exists
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const result = await pool.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
            [email, passwordHash]
        );

        const user = result.rows[0];

        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            user: {
                id: user.id,
                email: user.email,
                createdAt: user.created_at
            },
            token
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

app.post('/api/auth/signin', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({
                error: 'Database not configured. Please update DATABASE_URL in .env with your Neon database connection string.'
            });
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Find user
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            user: {
                id: user.id,
                email: user.email,
                createdAt: user.created_at
            },
            token
        });
    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({ error: 'Failed to sign in' });
    }
});

// Verify token endpoint
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// Listing endpoints
app.post('/api/listings', authenticateToken, async (req, res) => {
    try {
        const { title, brand, category, description, condition, rrp, price, keywords, sources, platform, images } = req.body;
        const userId = req.user.id;

        // Insert listing
        const listingResult = await pool.query(
            `INSERT INTO listings (user_id, title, brand, category, description, condition, rrp, price, keywords, sources, platform)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [userId, title, brand, category, description, condition, rrp, price, keywords, JSON.stringify(sources), platform]
        );

        const listing = listingResult.rows[0];

        // Insert images
        if (images && images.length > 0) {
            for (let i = 0; i < images.length; i++) {
                await pool.query(
                    'INSERT INTO images (listing_id, image_data, image_order, is_blurry) VALUES ($1, $2, $3, $4)',
                    [listing.id, images[i].data, i, images[i].isBlurry || false]
                );
            }
        }

        res.json({ listing });
    } catch (error) {
        console.error('Create listing error:', error);
        res.status(500).json({ error: 'Failed to create listing' });
    }
});

app.get('/api/listings', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get listings with first image
        const result = await pool.query(
            `SELECT l.*,
                    (SELECT json_agg(json_build_object('id', i.id, 'data', i.image_data, 'isBlurry', i.is_blurry, 'order', i.image_order) ORDER BY i.image_order)
                     FROM images i WHERE i.listing_id = l.id) as images
             FROM listings l
             WHERE l.user_id = $1
             ORDER BY l.created_at DESC`,
            [userId]
        );

        res.json({ listings: result.rows });
    } catch (error) {
        console.error('Get listings error:', error);
        res.status(500).json({ error: 'Failed to fetch listings' });
    }
});

app.get('/api/listings/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const listingId = req.params.id;

        // Get listing with images
        const result = await pool.query(
            `SELECT l.*,
                    (SELECT json_agg(json_build_object('id', i.id, 'data', i.image_data, 'isBlurry', i.is_blurry, 'order', i.image_order) ORDER BY i.image_order)
                     FROM images i WHERE i.listing_id = l.id) as images
             FROM listings l
             WHERE l.id = $1 AND l.user_id = $2`,
            [listingId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        res.json({ listing: result.rows[0] });
    } catch (error) {
        console.error('Get listing error:', error);
        res.status(500).json({ error: 'Failed to fetch listing' });
    }
});

app.put('/api/listings/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const listingId = req.params.id;
        const { title, brand, category, description, condition, rrp, price, keywords, sources, platform } = req.body;

        const result = await pool.query(
            `UPDATE listings
             SET title = $1, brand = $2, category = $3, description = $4, condition = $5,
                 rrp = $6, price = $7, keywords = $8, sources = $9, platform = $10
             WHERE id = $11 AND user_id = $12
             RETURNING *`,
            [title, brand, category, description, condition, rrp, price, keywords, JSON.stringify(sources), platform, listingId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        res.json({ listing: result.rows[0] });
    } catch (error) {
        console.error('Update listing error:', error);
        res.status(500).json({ error: 'Failed to update listing' });
    }
});

app.delete('/api/listings/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const listingId = req.params.id;

        const result = await pool.query(
            'DELETE FROM listings WHERE id = $1 AND user_id = $2 RETURNING id',
            [listingId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        res.json({ message: 'Listing deleted successfully' });
    } catch (error) {
        console.error('Delete listing error:', error);
        res.status(500).json({ error: 'Failed to delete listing' });
    }
});

// AI generation endpoint
app.post('/api/generate', authenticateToken, async (req, res) => {
    try {
        const { images, platform, hint } = req.body;

        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ error: 'At least one image required' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        // Using Gemini 2.0 Flash (stable) - Best for OCR/label reading as of Nov 2025
        // Research shows 2.0 Flash excels at text extraction from product labels
        // Gemini 2.5 models have worse OCR quality vs 2.0 Flash for straightforward text extraction
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        // Improved system prompt v3.0 - See SYSTEM-PROMPTS.md for details
        const userInfoHint = hint ? `\n**User-Provided Information:**\nThe user has specified: "${hint}"\n\nIncorporate this information into your analysis:\n- If mentioning packaging, note it in description\n- If mentioning specific flaws, detail them in condition\n- If mentioning size/fit, include in description\n` : '';

        const prompt = `${userInfoHint}You are an expert e-commerce listing specialist for the UK resale market. Your PRIMARY goal is to accurately identify the item by reading ALL visible text and labels in ALL the images provided.

**IMPORTANT: You will receive MULTIPLE images of the same item from different angles. Analyze ALL images to get the complete picture.**

**CRITICAL: TEXT AND LABEL READING PRIORITY**

Before making ANY assumptions about the item, you MUST:

1. **READ EVERY LABEL AND TAG FIRST** (This is your PRIMARY source of truth - check ALL images):
   - Brand logos and wordmarks on the item itself
   - Size tags (usually inside collar, waistband, or tongue)
   - Care labels (washing instructions often have brand name)
   - Product name tags or labels
   - Model numbers, style codes, SKU numbers
   - Material composition tags
   - Country of manufacture labels
   - Hang tags or original packaging text
   - Any printed or embroidered text on the item
   - **ESPECIALLY IMPORTANT: Size/Volume/Capacity markings**
     * Fragrance bottles: "50ml", "100ml", "1.7 FL OZ", "3.4 FL OZ"
     * Clothing: "UK 10", "M", "32W 32L", "EU 42"
     * Shoes: "UK 9", "US 10", "EU 44"
     * Electronics: "256GB", "128GB", storage capacity
     * Any other product-specific size indicators

   **ZOOM IN and READ CAREFULLY across ALL images** - Labels contain the exact product identity.

2. **Extract ALL visible text from ALL images:**
   - Look at close-up shots of labels in different images
   - Check inside views (collars, waistbands, tongues, insoles)
   - Read any text on boxes, packaging, or tags
   - Note style codes like "DM0029-100" or "AJ1234"
   - Identify size markings "UK 10", "M", "32W 32L", "50ml", "100ml"
   - Check front, back, side, and detail shots for text

3. **Physical identification (SECONDARY to labels):**
   - Only use visual design if NO labels are visible
   - Note distinctive patterns, logos, or design elements
   - Identify materials by texture and appearance
   - Observe color combinations and styling

**Item Identification Process - EXACT IDENTIFICATION IS CRUCIAL:**

Step 1: List ALL text you can read from labels and tags
Step 2: Use this text to identify the EXACT product (not similar, not close - EXACT)
Step 3: Use Google Search to verify: Search "[brand from label] [style code from label]" to confirm exact product
Step 4: If labels are unclear or missing, state "Unable to read labels clearly" and provide best visual match with LOW confidence
Step 5: NEVER guess model numbers or style codes that aren't visible

**Identity Confidence Levels:**
- HIGH CONFIDENCE: You can read the brand name, model, AND style code from labels + verified via Google Search
- MEDIUM CONFIDENCE: You can read brand and partial model info from labels
- LOW CONFIDENCE: No readable labels, identification based on visual similarity only

**CRUCIAL:** Exact item identification is the #1 priority. If you cannot identify the EXACT item from labels:
1. State this clearly in the description
2. Provide the closest match you can determine
3. Mark confidence as LOW
4. Use generic pricing ranges

Base your entire listing on what you can READ and VERIFY, not what you THINK you see

3. **Provide (based on label reading):**
   - **title**: Factual, SEO-friendly title (max 80 characters). Format: [Brand] [Product Line] [Key Feature] [Size/Variant]
     **CRITICAL: ALWAYS include size/volume if visible on labels**
     Examples:
     * "Acqua di Parma Colonia Intensa Eau de Cologne 100ml"
     * "Nike Air Jordan 1 Mid DM0029-100 UK 10"
     * "Samsung Galaxy S23 256GB Phantom Black"

   - **brand**: EXACT brand name as it appears on the label (not assumed)

   - **category**: Precise category path for ${platform}

   - **description**: Compelling marketing description (3-5 sentences, 100-200 words)
     **Structure:**
     1st sentence: Opening hook with brand, product name, and size (from labels)
     2nd-3rd sentences: Key features, benefits, or scent notes/specifications
     4th sentence: Condition and any notable details visible in images
     5th sentence: Call to action or unique selling point

     **IMPORTANT RULES:**
     - MUST mention size/volume in the first sentence if visible on labels
     - Start factual (what you can read), then add marketing appeal
     - Use descriptive, engaging language while staying truthful
     - Include materials from care labels and model numbers if visible
     - For fragrances: mention concentration (EDT, EDP, Cologne) and key notes if on packaging
     - For clothing: mention materials, fit, style details from labels
     - Describe condition naturally within the flow

     **Examples:**
     * Fragrance: "Acqua di Parma Colonia Intensa Eau de Cologne in the 100ml size. This sophisticated scent features vibrant Calabrian bergamot and Sicilian lemon top notes, enriched with warm cardamom and ginger. The heart reveals aromatic myrtle and neroli, while the base develops into rich leather and patchouli. The bottle shows minimal usage with clear liquid visible. Perfect for the discerning gentleman who appreciates Italian luxury."
     * Trainers: "Nike Air Jordan 1 Mid in UK Size 10 (Style: DM0029-100). These iconic basketball-inspired trainers feature the classic Mid silhouette with premium leather uppers. The colorway combines crisp white panels with bold accents. Condition is excellent with minimal creasing to toe box and clean outsoles. A versatile addition to any sneaker collection."

   - **rrp**: Original Recommended Retail Price in GBP. Format: "£XX.XX" or "Unknown"
     **CRITICAL:** Use Google Search to find the EXACT retail price when the item was new
     Search queries to try:
     * "{brand} {product name} {size} RRP UK"
     * "{brand} {product name} {size} retail price UK"
     * "{brand} {product name} original price"
     Include the size in your search to get accurate RRP for the specific variant

   - **price**: Competitive resale price in GBP based on SOLD listings. Format: "£XX"
     **REQUIRED:** Use Google Search to find recently SOLD listings on ${platform} for this exact item
     Search query example: "Acqua di Parma Colonia Intensa 100ml sold ${platform} uk"
     Look for completed/sold listings, not active listings
     Adjust for condition shown in the images

   - **condition**: Detailed condition assessment. Categories: New with Tags, Like New, Excellent, Very Good, Good, Fair, Poor.
     **IMPORTANT:** Base this on what you can SEE in ALL the images:
     - Check for scratches, scuffs, stains, wear patterns
     - Note packaging condition if visible
     - Assess liquid level for fragrances (e.g., "90% full", "Appears full")
     - Mention any visible damage or imperfections
     - Be honest and specific - buyers need accurate condition info

   - **keywords**: 5-10 relevant search terms (array of strings) - include any style codes or model numbers you read

   - **sources**: 1-2 reference URLs for price verification (array of objects with url and title)
     These will be automatically populated from your Google Search results

**Pricing Guidelines - USE GOOGLE SEARCH:**
1. Search for "{brand} {product name} sold ${platform}" to find actual sold prices
2. Search for "{brand} {product name} RRP" or "retail price" to find original price
3. Prioritize SOLD listings data over active listings
4. Adjust for condition (Excellent: 50-70% RRP, Good: 30-50% RRP, Fair: 15-30% RRP)
5. Be realistic, not optimistic
6. Use UK-based search results (prices in GBP)

**Output Requirements:**
Return ONLY valid JSON. No markdown code blocks, no explanatory text.

{
  "title": "",
  "brand": "",
  "category": "",
  "description": "",
  "condition": "",
  "rrp": "",
  "price": "",
  "keywords": [],
  "sources": [{"url": "", "title": ""}]
}

**CRITICAL RULES - LABEL ACCURACY:**

⚠️ ABSOLUTE REQUIREMENTS:
1. READ LABELS FIRST - Check every angle for tags, labels, text before identifying
2. QUOTE WHAT YOU READ - If you see "Nike" on a label, use "Nike" (not "appears to be Nike")
3. NO GUESSING MODELS - If you can't read a style code, don't invent one
4. STATE UNCERTAINTY - If labels are blurry or hidden, say "Unable to confirm exact model from visible labels"
5. EVIDENCE-BASED ONLY - Every detail in your listing must come from visible evidence

❌ NEVER DO:
- Make up style codes, model numbers, or SKUs not visible in photos
- Assume brand based on design alone without confirming with labels
- Identify specific product lines without reading tags
- Use generic descriptions when you can't read labels

✅ ALWAYS DO:
- Explicitly state what text you read from labels in the description
- Zoom in mentally on label close-ups
- Prioritize inside tags over external appearance
- Say "Label not visible" rather than guess
- Be specific about what you CAN and CANNOT see`;

        console.log(`🤖 Calling Gemini Vision API for ${platform} with ${images.length} image(s)`);

        // Build parts array: prompt text + all images
        const parts = [
            { text: prompt },
            ...images.map(img => ({
                inline_data: {
                    mime_type: 'image/jpeg',
                    data: img.split(',')[1]
                }
            }))
        ];

        // Enable Google Search grounding for real-time price research
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: parts
                }],
                tools: [{
                    googleSearch: {}
                }],
                generationConfig: {
                    temperature: 0.4,  // Lower temperature for more factual responses
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 2048
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Gemini API error:', response.status, errorData);
            throw new Error(`Gemini API request failed: ${response.status}`);
        }

        const data = await response.json();

        // Check for safety blocks or other issues
        if (!data.candidates || data.candidates.length === 0) {
            console.error('❌ No candidates in response:', data);
            throw new Error('No response from AI model');
        }

        const text = data.candidates[0].content.parts[0].text;
        console.log('✅ Received response from Gemini, length:', text.length);

        // Extract grounding metadata (Google Search sources)
        const groundingMetadata = data.candidates[0]?.groundingMetadata;
        const searchSources = [];

        if (groundingMetadata?.webSearchQueries) {
            console.log('🔍 Google Search queries used:', groundingMetadata.webSearchQueries);
        }

        if (groundingMetadata?.groundingChunks) {
            groundingMetadata.groundingChunks.forEach(chunk => {
                if (chunk.web?.uri && chunk.web?.title) {
                    searchSources.push({
                        url: chunk.web.uri,
                        title: chunk.web.title
                    });
                }
            });
            console.log('📚 Found', searchSources.length, 'research sources from Google Search');
        }

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const listing = JSON.parse(jsonMatch[0]);

            // Merge AI-generated sources with grounding sources
            if (searchSources.length > 0) {
                listing.sources = [...searchSources, ...(listing.sources || [])];
            }

            console.log('✅ Successfully generated listing:', listing.title);
            res.json({ listing });
        } else {
            console.error('❌ No JSON found in response. Raw text:', text.substring(0, 500));
            throw new Error('Failed to parse API response - no JSON found');
        }
    } catch (error) {
        console.error('❌ Generate listing error:', error.message);
        res.status(500).json({
            error: 'Failed to generate listing',
            details: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 QuickList AI server running on http://localhost:${PORT}`);
});

module.exports = app;
