#!/bin/bash
# Quick setup script for API Protection
# Run this to set up the database and environment

set -e

echo "🛡️  QuickList API Protection Setup"
echo "=================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable not set"
    echo ""
    echo "Please set it first:"
    echo "  export DATABASE_URL='your_database_url'"
    exit 1
fi

echo "✅ DATABASE_URL found"
echo ""

# Run migration
echo "📊 Running database migration..."
psql "$DATABASE_URL" < migrations/add_api_usage_tracking.sql

if [ $? -eq 0 ]; then
    echo "✅ Database migration complete"
else
    echo "❌ Migration failed"
    exit 1
fi

echo ""
echo "⚙️  Environment Variables Setup"
echo "================================"
echo ""
echo "Add these to your .env file (if not already set):"
echo ""
echo "# API Protection"
echo "GEMINI_MONTHLY_BUDGET=500  # Monthly spend limit in USD"
echo "GEMINI_EMERGENCY_SHUTDOWN=false  # Kill switch"
echo "ADMIN_EMAILS=your-email@example.com  # Comma-separated admin emails"
echo ""

# Check if .env exists and ask to append
if [ -f ".env" ]; then
    read -p "Append these variables to .env? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "" >> .env
        echo "# API Protection (added $(date +%Y-%m-%d))" >> .env
        echo "GEMINI_MONTHLY_BUDGET=500" >> .env
        echo "GEMINI_EMERGENCY_SHUTDOWN=false" >> .env
        echo "ADMIN_EMAILS=your-email@example.com" >> .env
        echo "✅ Added to .env - Don't forget to update ADMIN_EMAILS!"
    fi
fi

echo ""
echo "🎉 Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Update ADMIN_EMAILS in .env with your email"
echo "2. Restart your server: npm run dev"
echo "3. Test admin endpoint: curl http://localhost:4577/api/admin/usage-stats"
echo ""
echo "📖 Read API_PROTECTION.md for full documentation"
