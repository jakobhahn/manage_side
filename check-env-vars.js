// Check Environment Variables in Production
// Run this in Vercel Function to debug

console.log('=== Environment Variables Check ===');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');

// Check if URLs are valid
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.log('Supabase URL format:', process.env.NEXT_PUBLIC_SUPABASE_URL.includes('supabase.co'));
}

if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.log('Anon key length:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length);
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Service role key length:', process.env.SUPABASE_SERVICE_ROLE_KEY.length);
}
