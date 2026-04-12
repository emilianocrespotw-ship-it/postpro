import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

function getUserId(session: any): string | null {
  return session?.user?.email || session?.user?.name || null
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ logo_data: null })

  const { data } = await supabaseAdmin
    .from('agencies')
    .select('logo_data, name')
    .eq('user_id', userId)
    .single()

  return NextResponse.json(data || { logo_data: null })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { logo_data, name } = await req.json()

  await supabaseAdmin
    .from('agencies')
    .upsert({ user_id: userId, logo_data, name }, { onConflict: 'user_id' })

  return NextResponse.json({ ok: true })
}
