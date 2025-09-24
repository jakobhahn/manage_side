import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(_request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Check if environment variables are set
    const envCheck = {
      supabaseUrl: supabaseUrl ? 'SET' : 'NOT SET',
      supabaseAnonKey: supabaseAnonKey ? 'SET' : 'NOT SET',
      supabaseServiceKey: supabaseServiceKey ? 'SET' : 'NOT SET',
      supabaseUrlValid: supabaseUrl?.includes('supabase.co') || false,
      anonKeyLength: supabaseAnonKey?.length || 0,
      serviceKeyLength: supabaseServiceKey?.length || 0
    }

    // Try to create a Supabase client
    let clientTest = 'FAILED'
    try {
      if (supabaseUrl && supabaseServiceKey) {
        createClient(supabaseUrl, supabaseServiceKey)
        clientTest = 'SUCCESS'
      }
    } catch (error) {
      clientTest = `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`
    }

    return NextResponse.json({
      environment: envCheck,
      clientTest,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
