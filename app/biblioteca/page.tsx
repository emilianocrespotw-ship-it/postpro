'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface WinePhoto {
  id: string
  url: string
  marca: string
  varietal: string
  categoria: string
  created_at: string
}

interface WineGroup {
  marca: string
  varietal: string
  categoria: string
  photos: WinePhoto[]
}

function capitalize(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function BibliotecaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [groups, setGroups] = useState<WineGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const addPhotoRef = useRef<HTMLInputElement>(null)
  const [addTarget, setAddTarget] = useState<{ marca: string; varietal: string; categoria: string } | null>(null)

  const userId = session?.user?.email || (session?.user?.name ? `fb_${session.user.name}` : null)

  useEffect(() => {
    if (status === 'unauthenticated') { signIn('facebook'); return }
    if (!userId) return
    fetchCatalog()
  }, [userId, status])

  const fetchCatalog = async () => {
    if (!userId) return
    setLoading(true)
    const res = await fetch(`/api/wine-photos?userId=${encodeURIComponent(userId)}&catalog=true`)
    const data = await res.json()
    setGroups(data.catalog || [])
    setLoading(false)
  }

  const handleDelete = async (photoId: string) => {
    if (!userId) return
    setDeleting(photoId)
    await fetch('/api/wine-photos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId, userId }),
    })
    setDeleting(null)
    fetchCatalog()
  }

  const handleAddPhotos = (marca: string, varietal: string, categoria: string) => {
    setAddTarget({ marca, varietal, categoria })
    addPhotoRef.current?.click()
  }

  const handleAddFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !addTarget || !userId) return
    setUploading(`${addTarget.marca}||${addTarget.varietal}`)

    const files = Array.from(e.target.files)
    const photos: { base64: string; mime: string }[] = []

    for (const file of files) {
      await new Promise<void>(resolve => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const img = new window.Image()
          img.onload = () => {
            const MAX = 1600
            const scale = Math.min(1, MAX / Math.max(img.width, img.height))
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * scale)
            canvas.height = Math.round(img.height * scale)
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
            photos.push({ base64: dataUrl.split(',')[1], mime: 'image/jpeg' })
            resolve()
          }
          img.src = reader.result as string
        }
        reader.readAsDataURL(file)
      })
    }

    await fetch('/api/wine-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...addTarget, photos }),
    })

    setUploading(null)
    setAddTarget(null)
    e.target.value = ''
    fetchCatalog()
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Cargando biblioteca...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <input ref={addPhotoRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddFileChange} />

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between pt-4 mb-6">
          <button onClick={() => router.push('/')} className="text-slate-400 hover:text-white transition text-sm">← Inicio</button>
          <h1 className="text-white font-black text-xl">📚 Mi Biblioteca de Vinos</h1>
          <div />
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🍷</div>
            <p className="text-white font-bold text-lg mb-2">No tenés vinos guardados todavía</p>
            <p className="text-slate-400 text-sm mb-6">Cuando subas fotos al crear un post de vinoteca, se guardan acá automáticamente.</p>
            <button onClick={() => router.push('/crear?rubro=vinoteca')}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl transition">
              Crear primer post 🍷
            </button>
          </div>
        ) : (
          <>
            <p className="text-slate-400 text-sm mb-4">
              {groups.length} {groups.length === 1 ? 'vino guardado' : 'vinos guardados'} · Las fotos se usan automáticamente al crear un post
            </p>

            <div className="space-y-3">
              {groups.map(group => {
                const key = `${group.marca}||${group.varietal}||${group.categoria}`
                const isExpanded = expandedKey === key
                const isUploading = uploading === `${group.marca}||${group.varietal}`

                return (
                  <div key={key} className="bg-white/10 rounded-2xl overflow-hidden">
                    {/* Header row */}
                    <button
                      onClick={() => setExpandedKey(isExpanded ? null : key)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition">
                      {/* Thumbnail */}
                      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-slate-700">
                        {group.photos[0] && (
                          <img src={group.photos[0].url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm leading-tight">
                          {capitalize(group.marca)}
                        </p>
                        <p className="text-slate-300 text-xs mt-0.5">
                          {capitalize(group.varietal)}
                          {group.categoria ? ` · ${capitalize(group.categoria)}` : ''}
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {group.photos.length} {group.photos.length === 1 ? 'foto' : 'fotos'}
                        </p>
                      </div>

                      {/* Chevron */}
                      <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>

                    {/* Expanded photos */}
                    {isExpanded && (
                      <div className="px-4 pb-4">
                        <div className="grid grid-cols-4 gap-2 mb-3">
                          {group.photos.map(photo => (
                            <div key={photo.id} className="relative aspect-square">
                              <img src={photo.url} alt="" className="w-full h-full object-cover rounded-xl" />
                              <button
                                onClick={() => handleDelete(photo.id)}
                                disabled={deleting === photo.id}
                                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs transition disabled:opacity-50">
                                {deleting === photo.id ? '…' : '✕'}
                              </button>
                            </div>
                          ))}

                          {/* Add more button */}
                          {group.photos.length < 6 && (
                            <button
                              onClick={() => handleAddPhotos(group.marca, group.varietal, group.categoria)}
                              disabled={!!isUploading}
                              className="aspect-square rounded-xl border-2 border-dashed border-slate-600 hover:border-slate-400 flex flex-col items-center justify-center text-slate-500 hover:text-white transition text-xs gap-1 disabled:opacity-50">
                              {isUploading ? '⏳' : <><span className="text-xl">+</span><span>Agregar</span></>}
                            </button>
                          )}
                        </div>

                        {/* Quick post button */}
                        <button
                          onClick={() => router.push(`/crear?rubro=vinoteca`)}
                          className="w-full bg-purple-600/40 hover:bg-purple-600/60 text-purple-200 text-xs font-semibold py-2 rounded-xl transition">
                          🍷 Crear post con este vino
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
