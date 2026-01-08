# Migration 009: Organization Address Field

## 📋 What this adds:
- Address field to organizations table
- Address input in settings page
- Dynamic weather data based on organization address

## 🚀 To apply this migration:

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run this SQL:

```sql
-- Add address field to organizations table for weather API
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.address IS 'Physical address of the organization for weather data and location services';
```

### Option 2: Supabase CLI
```bash
supabase db push
```

## ✅ After migration:

1. **Settings Page**: Users can now enter their restaurant address
2. **Weather API**: Will use the organization address for weather data
3. **Geocoding**: Automatic conversion from address to coordinates
4. **Fallback**: Hamburg coordinates if address is not provided or invalid

## 🧪 Testing:

1. Go to `/dashboard/settings`
2. Enter an address (e.g., "Berlin, Germany")
3. Save settings
4. Trigger weather sync (the API will now use your address)

## 🔧 Features:

- **Free Geocoding**: Uses Open-Meteo's geocoding API (no API key needed)
- **Fallback Safety**: Always falls back to Hamburg if geocoding fails
- **Real-time Updates**: Address changes immediately affect weather data
- **User-friendly**: Clear instructions in the settings form








