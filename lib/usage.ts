import { supabaseAdmin } from './supabase'

export const ADMIN_EMAIL = 'emiliano.crespo.tw@gmail.com'
const ADMIN_IDS = ['fb_10164390846133390']
export const FREE_LIMIT = 10

function currentMonth() {
  return new Date().toISOString().slice(0, 7) // '2026-04'
}

export interface UsageInfo {
  allowed: boolean
  isAdmin: boolean
  isPro: boolean
  usedCount: number
  limit: number
}

export async function getUserUsage(email: string): Promise<UsageInfo> {
  if (email === ADMIN_EMAIL || ADMIN_IDS.includes(email)) {
    return { allowed: true, isAdmin: true, isPro: true, usedCount: 0, limit: Infinity }
  }

  const month = currentMonth()

  // Upsert user
  await supabaseAdmin
    .from('users')
    .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('plan')
    .eq('email', email)
    .single()

  const isPro = user?.plan === 'pro'
  if (isPro) {
    return { allowed: true, isAdmin: false, isPro: true, usedCount: 0, limit: Infinity }
  }

  const { data: usageRow } = await supabaseAdmin
    .from('usage')
    .select('count')
    .eq('email', email)
    .eq('month', month)
    .single()

  const usedCount = usageRow?.count ?? 0

  return {
    allowed: usedCount < FREE_LIMIT,
    isAdmin: false,
    isPro: false,
    usedCount,
    limit: FREE_LIMIT,
  }
}

export async function incrementUsage(email: string): Promise<void> {
  if (email === ADMIN_EMAIL || ADMIN_IDS.includes(email)) return
  const month = currentMonth()

  const { data: existing } = await supabaseAdmin
    .from('usage')
    .select('count')
    .eq('email', email)
    .eq('month', month)
    .single()

  const newCount = (existing?.count ?? 0) + 1

  await supabaseAdmin
    .from('usage')
    .upsert({ email, month, count: newCount }, { onConflict: 'email,month' })
}
