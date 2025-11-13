/**
 * Database connection module
 * Exports a PostgreSQL pool for use across the application
 */

const { Pool } = require('pg');

// Only load .env in non-production environments
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  require('dotenv').config();
}

// Create database connection pool
let pool;

if (
  process.env.DATABASE_URL &&
  process.env.DATABASE_URL !==
    'postgresql://placeholder:placeholder@placeholder.neon.tech/quicklist?sslmode=require'
) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Timeout after 10 seconds trying to connect
  });

  // Log successful connection
  pool.on('connect', () => {
    console.log('Database connected');
  });

  // Log errors
  pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
  });
} else {
  console.warn('Database connection not configured');
  // Create a dummy pool that throws errors if used
  pool = {
    query: () => {
      throw new Error('Database not configured');
    },
    connect: () => {
      throw new Error('Database not configured');
    },
  };
}

module.exports = pool;
