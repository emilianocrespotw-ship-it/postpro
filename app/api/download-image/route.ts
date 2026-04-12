import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_DOMAINS = [
  'images.pexels.com',
  'www.pexels.com',
  'images.unsplash.com',
  'supabase.co',
  'supabase.in',
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  if (!url) return NextResponse.json({ error: 'URL requerida' }, { status: 400 })

  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
  }

  const isAllowed = ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))
  if (!isAllowed) {
    return NextResponse.json({ error: 'Dominio no permitido' }, { status: 403 })
  }

  const res = await fetch(url)
  if (!res.ok) return NextResponse.json({ error: 'No se pudo descargar la imagen' }, { status: 502 })

  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const buffer = await res.arrayBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
