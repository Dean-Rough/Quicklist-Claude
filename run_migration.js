
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function run() {
  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(path.join(__dirname, 'schema_cloudinary_migration.sql'), 'utf8');
    
    console.log('Executing migration...');
    await pool.query(sql);
    
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

run();
