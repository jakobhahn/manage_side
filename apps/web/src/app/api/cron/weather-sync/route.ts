import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Prüfe ob der Request von einem Cron-Service kommt
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🕐 Starting scheduled weather data sync...')

    // Rufe die Weather-Sync-API auf
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/weather/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Weather sync failed: ${response.status}`)
    }

    const result = await response.json()

    console.log('🕐 Scheduled weather sync completed:', result)

    return NextResponse.json({
      success: true,
      message: 'Weather sync completed successfully',
      timestamp: new Date().toISOString(),
      result
    })

  } catch (error: any) {
    console.error('Cron weather sync error:', error)
    return NextResponse.json({ 
      error: 'Weather sync failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
