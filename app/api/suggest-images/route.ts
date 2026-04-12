import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q') || ''
  const rubroQuery = searchParams.get('rubro') || ''

  if (!query) return NextResponse.json({ images: [] })

  const searchQ = `${query} ${rubroQuery}`.trim()

  try {
    const pexelsRes = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQ)}&per_page=20&orientation=landscape`,
      { headers: { Authorization: process.env.PEXELS_API_KEY! } }
    )
    const data = await pexelsRes.json()
    const images = data.photos?.map((p: any) => ({
      url: p.src.large,
      thumb: p.src.medium,
      photographer: p.photographer,
    })) || []

    return NextResponse.json({ images })
  } catch (e) {
    console.error('Pexels error', e)
    return NextResponse.json({ images: [] })
  }
}
