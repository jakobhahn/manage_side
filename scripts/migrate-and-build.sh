#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting deployment process..."

# Check if we're in production environment
if [ "$VERCEL_ENV" = "production" ]; then
    echo "📦 Production deployment detected"
    
    # Install Supabase CLI if not present
    if ! command -v supabase &> /dev/null; then
        echo "📥 Installing Supabase CLI..."
        npm install -g supabase
    fi
    
    # Run database migrations
    echo "🗃️ Running database migrations..."
    
    # Set Supabase project reference and access token from environment variables
    export SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN"
    export SUPABASE_DB_PASSWORD="$SUPABASE_DB_PASSWORD"
    
    # Link to the project (using environment variables)
    supabase link --project-ref "$SUPABASE_PROJECT_REF"
    
    # Push migrations to production database
    supabase db push --password "$SUPABASE_DB_PASSWORD"
    
    echo "✅ Database migrations completed successfully"
else
    echo "🔧 Non-production environment, skipping migrations"
fi

# Build the Next.js application
echo "🏗️ Building Next.js application..."
pnpm run build

echo "🎉 Deployment process completed successfully!"

