import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'wine-photos'
const MAX_PER_WINE = 6   // máximo fotos guardadas por vino

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9áéíóúüñ\s]/g, '').replace(/\s+/g, '_')
}

// ── GET: fetch photos ─────────────────────────────────────────────────────────
// Modes:
//   ?userId=X&marca=Y&varietal=Z&categoria=W  → fotos de un vino específico
//   ?userId=X&catalog=true                    → todos los vinos con sus fotos (para /biblioteca)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId   = searchParams.get('userId')
  const marca    = searchParams.get('marca')
  const varietal = searchParams.get('varietal')
  const categoria = searchParams.get('categoria') || ''
  const catalog  = searchParams.get('catalog') === 'true'

  if (!userId) return NextResponse.json({ photos: [], catalog: [] })

  // ── Catalog mode: devolver todos los vinos agrupados ─────────────────────
  if (catalog) {
    const { data, error } = await supabaseAdmin
      .from('wine_photos')
      .select('id, url, marca, varietal, categoria, created_at')
      .eq('user_id', userId)
      .order('marca', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) console.error('wine_photos catalog GET error', error)

    // Agrupar por marca+varietal+categoria
    const grouped: Record<string, { marca: string; varietal: string; categoria: string; photos: any[] }> = {}
    for (const row of data || []) {
      const key = `${row.marca}||${row.varietal}||${row.categoria}`
      if (!grouped[key]) {
        grouped[key] = { marca: row.marca, varietal: row.varietal, categoria: row.categoria || '', photos: [] }
      }
      grouped[key].photos.push(row)
    }
    return NextResponse.json({ catalog: Object.values(grouped) })
  }

  // ── Single wine mode ──────────────────────────────────────────────────────
  if (!marca) return NextResponse.json({ photos: [] })

  const query = supabaseAdmin
    .from('wine_photos')
    .select('id, url, marca, varietal, categoria, created_at')
    .eq('user_id', userId)
    .eq('marca', normalize(marca))
    .order('created_at', { ascending: false })
    .limit(MAX_PER_WINE)

  if (varietal) query.eq('varietal', normalize(varietal))

  // Buscar primero coincidencia exacta con categoría, si no trae todas las de marca+varietal
  if (categoria) {
    const exactQ = supabaseAdmin
      .from('wine_photos')
      .select('id, url, marca, varietal, categoria, created_at')
      .eq('user_id', userId)
      .eq('marca', normalize(marca))
      .eq('varietal', normalize(varietal || ''))
      .eq('categoria', normalize(categoria))
      .order('created_at', { ascending: false })
      .limit(MAX_PER_WINE)

    const { data: exactData } = await exactQ
    if (exactData && exactData.length > 0) {
      return NextResponse.json({ photos: exactData })
    }
    // fallback: misma marca+varietal sin importar categoría
  }

  const { data, error } = await query
  if (error) console.error('wine_photos GET error', error)

  return NextResponse.json({ photos: data || [] })
}

// ── POST: save uploaded photos to the wine library ────────────────────────────
// Body: { userId, marca, varietal, categoria, photos: [{ base64, mime }] }
export async function POST(req: NextRequest) {
  try {
    const { userId, marca, varietal, categoria = '', photos } = await req.json()

    if (!userId || !marca || !photos?.length) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const marcaNorm    = normalize(marca)
    const varNorm      = normalize(varietal || 'general')
    const categoriaNorm = normalize(categoria)

    // Check how many photos already exist for this exact wine — don't exceed MAX_PER_WINE
    const { count } = await supabaseAdmin
      .from('wine_photos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('marca', marcaNorm)
      .eq('varietal', varNorm)
      .eq('categoria', categoriaNorm)

    const existing = count || 0
    const canAdd = Math.max(0, MAX_PER_WINE - existing)
    const toProcess = photos.slice(0, canAdd)

    if (toProcess.length === 0) {
      return NextResponse.json({ saved: 0, message: `Límite de ${MAX_PER_WINE} fotos por vino alcanzado` })
    }

    // Ensure bucket exists
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    if (!buckets?.find(b => b.name === BUCKET)) {
      await supabaseAdmin.storage.createBucket(BUCKET, { public: false })
    }

    const saved: string[] = []

    for (const photo of toProcess) {
      const { base64, mime = 'image/jpeg' } = photo
      const ext = mime.split('/')[1] || 'jpg'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const storagePath = `${userId}/${marcaNorm}/${varNorm}/${categoriaNorm || 'general'}/${filename}`

      // Convert base64 to buffer
      const buffer = Buffer.from(base64, 'base64')

      const { error: uploadErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType: mime, upsert: false })

      if (uploadErr) {
        console.error('Upload error', uploadErr)
        continue
      }

      // Get signed URL (valid 10 years)
      const { data: signedData } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10)

      if (!signedData?.signedUrl) continue

      // Save to DB
      await supabaseAdmin.from('wine_photos').insert({
        user_id: userId,
        marca: marcaNorm,
        varietal: varNorm,
        categoria: categoriaNorm,
        url: signedData.signedUrl,
        storage_path: storagePath,
      })

      saved.push(signedData.signedUrl)
    }

    return NextResponse.json({ saved: saved.length, urls: saved })

  } catch (err: any) {
    console.error('wine-photos POST error', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── DELETE: remove a specific photo ──────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { photoId, userId } = await req.json()
    if (!photoId || !userId) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

    const { data: photo } = await supabaseAdmin
      .from('wine_photos')
      .select('storage_path, user_id')
      .eq('id', photoId)
      .single()

    if (!photo || photo.user_id !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    await supabaseAdmin.storage.from(BUCKET).remove([photo.storage_path])
    await supabaseAdmin.from('wine_photos').delete().eq('id', photoId)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
