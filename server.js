const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('✅ Database connected successfully');
    }
});

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
        const { image, platform, hint } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'Image required' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

        const prompt = `You are an expert at creating product listings for online marketplaces. Analyze this image and create a complete, professional listing for ${platform}.

${hint ? `Additional context: ${hint}` : ''}

Please provide:
1. A compelling, keyword-rich title (max 80 characters)
2. The brand name (if identifiable)
3. The most appropriate category
4. A detailed, honest description highlighting features, condition, and any flaws (3-5 sentences)
5. The condition (New, Like New, Good, Fair, Poor)
6. Estimated original retail price (RRP) in GBP
7. A competitive suggested listing price in GBP based on condition
8. 10 relevant keywords/hashtags
9. 2-3 URLs of similar items for price verification (use real marketplace URLs)

Format your response as JSON with this structure:
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
}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: 'image/jpeg',
                                data: image.split(',')[1]
                            }
                        }
                    ]
                }]
            })
        });

        if (!response.ok) {
            throw new Error('Gemini API request failed');
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const listing = JSON.parse(jsonMatch[0]);
            res.json({ listing });
        } else {
            throw new Error('Failed to parse API response');
        }
    } catch (error) {
        console.error('Generate listing error:', error);
        res.status(500).json({ error: 'Failed to generate listing' });
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
