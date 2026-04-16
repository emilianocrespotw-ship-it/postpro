import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserUsage, incrementUsage } from '@/lib/usage'
import RUBROS, { RubroId } from '@/lib/rubros'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function cleanJSON(text: string) {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : JSON.parse(text)
  } catch (e) {
    console.error('Error parsing JSON:', text)
    throw new Error('La IA no devolvió un formato válido.')
  }
}

function toStr(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function looksLikePrice(s: string): boolean {
  return /^\$?[\d.,]+$/.test(s.trim())
}

function cleanPrice(raw: string): string {
  const s = raw.trim()
  if (!s || s === 'N/A' || s === '-' || s === '0') return ''
  if (/\b0\b/.test(s) && !/[1-9]/.test(s)) return ''
  return s
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      rubroId,
      imageBase64,
      mimeType = 'image/jpeg',
      formData,
      email,
      allUploads = [],   // [{ base64, mime }] — todas las fotos subidas (vinoteca)
    } = body

    if (!rubroId || !RUBROS[rubroId as RubroId]) {
      return NextResponse.json({ error: 'Rubro inválido' }, { status: 400 })
    }

    const rubro = RUBROS[rubroId as RubroId]

    if (!imageBase64 && !formData) {
      return NextResponse.json({ error: 'Se requiere imagen o datos del formulario' }, { status: 400 })
    }

    // ── Verificar plan y límite ──────────────────────────────────────────────
    if (!email) {
      return NextResponse.json({ error: 'Email requerido', code: 'NO_EMAIL' }, { status: 400 })
    }

    const usage = await getUserUsage(email)
    if (!usage.allowed) {
      return NextResponse.json(
        { error: 'Límite del plan gratuito alcanzado', code: 'LIMIT_REACHED', usedCount: usage.usedCount },
        { status: 403 }
      )
    }

    let extracted: Record<string, any> = {}

    // ── PASO 1: Extraer datos (imagen o form) ────────────────────────────────
    if (imageBase64) {
      console.log(`[${rubroId}] Extrayendo datos de imagen...`)

      const extractionResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: rubro.extractionPrompt,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType as any, data: imageBase64 }
            },
            {
              type: 'text',
              text: 'Extraé los datos de esta imagen. Respondé SOLO con el JSON indicado.'
            }
          ]
        }]
      })

      extracted = cleanJSON((extractionResponse.content[0] as any).text)

      // ── Validación post-extracción para vinoteca ──
      if (rubroId === 'vinoteca') {
        const marcaRaw = toStr(extracted.marca || '')
        // Si la "marca" parece un precio (solo números), moverla a precio y limpiar marca
        if (marcaRaw && looksLikePrice(marcaRaw)) {
          console.warn(`[vinoteca] marca="${marcaRaw}" parece precio — reubicando`)
          if (!extracted.precio) extracted.precio = marcaRaw
          extracted.marca = ''
        }
        // Si el año tiene más de 4 dígitos o parece precio, limpiarlo
        const añoRaw = toStr(extracted.año || '')
        if (añoRaw && (añoRaw.length !== 4 || looksLikePrice(añoRaw) && parseInt(añoRaw) > 2100)) {
          extracted.año = ''
        }
      }
    } else {
      // Form data — map directly
      extracted = { ...formData }

      // Build searchQuery from main field + rubro hint
      const mainField = toStr(formData[rubro.overlayFields.line1Key] || '')
      extracted.searchQuery = `${mainField} ${rubro.searchQueryHint}`
    }

    // ── PASO 2: Generar textos ───────────────────────────────────────────────
    console.log(`[${rubroId}] Generando textos...`)

    // Build summary for text generation
    const summaryLines = Object.entries(extracted)
      .filter(([k, v]) => k !== 'searchQuery' && v && toStr(v).length > 0)
      .map(([k, v]) => {
        if (Array.isArray(v)) return `${k}: ${v.join(', ')}`
        return `${k}: ${toStr(v)}`
      })
    const summary = summaryLines.join('\n')

    const textResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: rubro.textPrompt,
      messages: [{
        role: 'user',
        content: `Generá los textos para este contenido:\n${summary}`
      }]
    })

    const texts = cleanJSON((textResponse.content[0] as any).text)
    // Extraer campos adicionales de vinoteca (enologist, story, cta)
    const enologist = toStr(texts.enologist || '')
    const story     = toStr(texts.story || '')
    const cta       = toStr(texts.cta || '')

    // ── PASO 3: Imágenes ─────────────────────────────────────────────────────
    console.log(`[${rubroId}] Buscando/generando imágenes...`)
    let images: string[] = []

    // Para heladería: generar imagen con IA (Pollinations/Flux) en lugar de Pexels
    if (rubroId === 'heladeria') {
      const promo = toStr(extracted.promo || '')
      const producto = toStr(extracted.producto || '')
      const local = toStr(extracted.local || '')

      // Construir prompt para imagen generada por IA
      const promoShort = promo.length > 60 ? promo.slice(0, 60) : promo
      const aiPromptParts = [
        'colorful artisan ice cream shop promotional poster',
        'vibrant illustrated style, appetizing and fun',
        producto ? `featuring ${producto} flavor ice cream` : 'featuring colorful gelato scoops',
        'beautiful pastel and vivid colors, food photography style',
        'instagram-worthy, cheerful atmosphere',
        'NO text overlays, clean background',
      ]
      const aiPrompt = aiPromptParts.join(', ')

      // Generar 3 variantes con seeds distintos para dar opciones
      const seeds = [42, 137, 891]
      const aiImages: string[] = seeds.map(seed =>
        `https://image.pollinations.ai/prompt/${encodeURIComponent(aiPrompt)}?width=1080&height=1080&seed=${seed}&nologo=true&enhance=true`
      )
      images = aiImages
      console.log(`[heladeria] ${aiImages.length} imágenes AI generadas`)
    }

    // Para vinoteca: buscar fotos guardadas de esta marca+varietal específica
    if (rubroId === 'vinoteca') {
      const marca   = toStr(extracted.marca || extracted.winery || '')
      const varietal = toStr(extracted.varietal || '')

      if (marca) {
        try {
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
          const categoria = toStr(extracted.categoria || '')
          const params = new URLSearchParams({ userId: email, marca, varietal, categoria })
          const wineRes = await fetch(`${baseUrl}/api/wine-photos?${params}`)
          const wineData = await wineRes.json()
          const savedPhotos: string[] = (wineData.photos || []).map((p: any) => p.url)
          images = [...savedPhotos]
          console.log(`[vinoteca] ${savedPhotos.length} fotos guardadas para ${marca} ${varietal} ${categoria}`)
        } catch (e) {
          console.error('wine-photos fetch error', e)
        }
      }
      // Nota: las fotos subidas por el usuario las agrega el frontend directamente
      // No usamos marcadores __uploaded__ para evitar problemas con tipos de imagen
    }
    // Para otros rubros tampoco agregamos marcadores: el frontend prepend sus propias previews

    // Completar con Pexels atmosférico (no para heladería que usa IA)
    const pexelsNeeded = rubroId === 'heladeria' ? 0 : Math.max(0, 5 - images.filter(u => !u.startsWith('__')).length)
    if (pexelsNeeded > 0) {
      try {
        const searchQ = toStr(extracted.searchQuery) || rubro.searchQueryHint
        const pexelsRes = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQ)}&per_page=${pexelsNeeded + 2}&orientation=landscape`,
          { headers: { Authorization: process.env.PEXELS_API_KEY! } }
        )
        const data = await pexelsRes.json()
        const pexelsPhotos: string[] = data.photos?.slice(0, pexelsNeeded + 1).map((p: any) => p.src.large) || []
        images = [...images, ...pexelsPhotos]
      } catch (e) {
        console.error('Pexels error', e)
      }
    }

    // ── Incrementar uso ──────────────────────────────────────────────────────
    await incrementUsage(email)

    // ── Guardar en Supabase ──────────────────────────────────────────────────
    try {
      const line1 = toStr(extracted[rubro.overlayFields.line1Key] || '')
      await supabaseAdmin.from('posts').insert([{
        rubro: rubroId,
        email,
        main_field: line1,
        text_facebook: toStr(texts.facebook),
        text_instagram: toStr(texts.instagram),
        image_url: images[0] || null,
      }])
    } catch (e) {
      console.warn('Supabase insert error', e)
    }

    // ── Guardar fotos al banco de vinos (vinoteca) ──────────────────────────
    if (rubroId === 'vinoteca' && allUploads.length > 0) {
      const marca   = toStr(extracted.marca || extracted.winery || '')
      const varietal = toStr(extracted.varietal || '')
      if (marca) {
        try {
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
          const categoria = toStr(extracted.categoria || '')
          await fetch(`${baseUrl}/api/wine-photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: email, marca, varietal, categoria, photos: allUploads }),
          })
          console.log(`[vinoteca] ${allUploads.length} fotos guardadas al banco de ${marca} ${varietal}`)
        } catch (e) {
          console.warn('wine-photos save error', e)
        }
      }
    }

    // ── Limpiar campos clave ─────────────────────────────────────────────────
    // Normalizar campo precio (puede venir como "price" o "precio" según el rubro)
    const rawPrice = toStr(extracted.price || extracted.precio || '')
    const price = cleanPrice(rawPrice)

    let line1: string
    let line2: string
    let badge: string

    if (rubroId === 'vinoteca') {
      // Vinoteca: line1 = MARCA (grande), line2 = varietal + categoría + año, line3 = precio
      const varietal = toStr(extracted.varietal || '')
      const categoria = toStr(extracted.categoria || '')
      const marca = toStr(extracted.marca || extracted.winery || '')
      const año = toStr(extracted.año || '')

      line1 = marca || varietal
      const subparts = [varietal, categoria, año].filter(Boolean)
      line2 = subparts.join(' · ')
      badge = price   // precio va como badge (más chico, abajo del todo)
    } else {
      line1 = toStr(extracted[rubro.overlayFields.line1Key] || '')
      const rawLine2 = rubro.overlayFields.line2Key
        ? toStr(extracted[rubro.overlayFields.line2Key] || '')
        : ''
      line2 = rawLine2 === rawPrice ? price : rawLine2
      badge = rubro.overlayFields.badgeKey
        ? toStr(extracted[rubro.overlayFields.badgeKey] || '')
        : ''
    }

    return NextResponse.json({
      rubroId,
      extracted,
      line1,
      line2,
      badge,
      price,
      searchQuery: toStr(extracted.searchQuery) || rubro.searchQueryHint,
      textFacebook: toStr(texts.facebook),
      textInstagram: toStr(texts.instagram),
      enologist,
      story,
      cta,
      images,
      usedCount: usage.usedCount + 1,
      isPro: usage.isPro,
    })

  } catch (error: any) {
    console.error('ERROR:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
