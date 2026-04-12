'use client'

import { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import RUBROS, { RubroId, RubroConfig } from '@/lib/rubros'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProcessResult {
  rubroId: RubroId
  extracted: Record<string, any>
  line1: string
  line2: string
  badge: string
  price: string
  searchQuery: string
  textFacebook: string
  textInstagram: string
  enologist: string
  story: string
  cta: string
  images: string[]
  usedCount: number
  isPro: boolean
}

interface UploadedImage {
  preview: string   // data URL para mostrar
  base64: string    // sin prefijo, para enviar a la API
  mime: string
}

const ADMIN_WHATSAPP = '5491100000000' // ← Reemplazar con tu número real

// ─── Fuente por rubro ─────────────────────────────────────────────────────────
const RUBRO_FONT: Record<string, string> = {
  vinoteca:     '"Playfair Display", Georgia, serif',
  turismo:      'Inter, system-ui, sans-serif',
  inmobiliaria: 'Inter, system-ui, sans-serif',
  gastronomia:  'Inter, system-ui, sans-serif',
}

// ─── Filter presets ───────────────────────────────────────────────────────────
const FILTERS = [
  { id: 'none',      label: 'Original',  css: 'none' },
  { id: 'vivid',     label: 'Vívido',    css: 'saturate(1.5) contrast(1.1)' },
  { id: 'warm',      label: 'Cálido',    css: 'sepia(0.35) saturate(1.3) brightness(1.05)' },
  { id: 'cool',      label: 'Frío',      css: 'hue-rotate(20deg) saturate(1.2) brightness(1.02)' },
  { id: 'dramatic',  label: 'Dramático', css: 'contrast(1.3) saturate(1.2) brightness(0.9)' },
  { id: 'bw',        label: 'B&N',       css: 'grayscale(1) contrast(1.1)' },
  { id: 'fade',      label: 'Fade',      css: 'brightness(1.1) saturate(0.8) contrast(0.9)' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function compressImage(file: File): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const img = new window.Image()
      img.onload = () => {
        const MAX_PX = 1600
        const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        const preview = canvas.toDataURL('image/jpeg', 0.88)
        resolve({ preview, base64: preview.split(',')[1], mime: 'image/jpeg' })
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Upgrade Modal ─────────────────────────────────────────────────────────────
function UpgradeModal({ onClose }: { onClose: () => void }) {
  const msg = encodeURIComponent('Hola! Llegué al límite de posts gratuitos en PostPro. Me gustaría seguir usando la app 🙌')
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Límite alcanzado</h2>
        <p className="text-gray-600 mb-6 text-sm leading-relaxed">
          Usaste tus <strong>10 posts gratuitos</strong> del mes. Para seguir publicando sin límites, contactanos y te activamos el plan Pro.
        </p>
        <a href={`https://wa.me/${ADMIN_WHATSAPP}?text=${msg}`} target="_blank" rel="noopener noreferrer"
          className="block w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-xl mb-3 transition">
          📲 Contactar por WhatsApp
        </a>
        <button onClick={onClose} className="text-gray-400 text-sm hover:text-gray-600 transition">Volver</button>
      </div>
    </div>
  )
}

// ─── Inner component ──────────────────────────────────────────────────────────
function CrearInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()

  const rubroId = (searchParams.get('rubro') || 'turismo') as RubroId
  const rubro: RubroConfig = RUBROS[rubroId] || RUBROS.turismo
  const overlayFont = RUBRO_FONT[rubroId] || RUBRO_FONT.turismo

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<'input' | 'processing' | 'result' | 'preview'>('input')
  const [inputMode, setInputMode] = useState<'image' | 'form'>('image')

  // Multi-image upload
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [activeUploadIdx, setActiveUploadIdx] = useState(0)   // which image to send to AI

  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [error, setError] = useState('')

  // Photo / overlay state
  const [selectedPhoto, setSelectedPhoto] = useState('')
  const [photoList, setPhotoList] = useState<string[]>([])  // editable en preview
  const [selectedFilter, setSelectedFilter] = useState('none')
  const [agencyLogo, setAgencyLogo] = useState('')
  const [showLogo, setShowLogo] = useState(true)
  const [showUpgrade, setShowUpgrade] = useState(false)

  // Text tab
  const [activeTab, setActiveTab] = useState<'facebook' | 'instagram'>('facebook')
  const [copied, setCopied] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const currentFilter = FILTERS.find(f => f.id === selectedFilter) || FILTERS[0]
  const activeImage = uploadedImages[activeUploadIdx] || null

  // ── Logo persistence ───────────────────────────────────────────────────────
  useEffect(() => {
    const cached = localStorage.getItem('pp_logo')
    if (cached) setAgencyLogo(cached)
    if (session?.user?.email) {
      fetch('/api/agency').then(r => r.json()).then(d => {
        if (d.logo_data) { setAgencyLogo(d.logo_data); localStorage.setItem('pp_logo', d.logo_data) }
      }).catch(() => {})
    }
  }, [session?.user?.email])

  // ── Paste screenshot (Ctrl+V) ──────────────────────────────────────────────
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || [])
      const imgItem = items.find(i => i.type.startsWith('image/'))
      if (!imgItem) return
      const file = imgItem.getAsFile()
      if (!file) return
      try {
        const compressed = await compressImage(file)
        setUploadedImages(prev => [...prev, compressed])
        setActiveUploadIdx(prev => uploadedImages.length) // point to new one
      } catch {}
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [uploadedImages.length])

  // ── File handlers ──────────────────────────────────────────────────────────
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (arr.length === 0) return
    const compressed = await Promise.all(arr.map(compressImage))
    setUploadedImages(prev => {
      const updated = [...prev, ...compressed]
      setActiveUploadIdx(updated.length - 1)  // select last added
      return updated
    })
  }, [])

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    addFiles(e.dataTransfer.files)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''  // reset so same file can be re-added
  }

  const removeImage = (idx: number) => {
    setUploadedImages(prev => {
      const updated = prev.filter((_, i) => i !== idx)
      if (activeUploadIdx >= updated.length) setActiveUploadIdx(Math.max(0, updated.length - 1))
      return updated
    })
  }

  // ── Logo upload ────────────────────────────────────────────────────────────
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const data = reader.result as string
      setAgencyLogo(data)
      localStorage.setItem('pp_logo', data)
      if (session?.user?.email) {
        fetch('/api/agency', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logo_data: data }) }).catch(() => {})
      }
    }
    reader.readAsDataURL(file)
  }

  // ── Process ────────────────────────────────────────────────────────────────
  const handleProcess = async () => {
    if (!session?.user?.email) { signIn('facebook'); return }

    if (inputMode === 'image' && uploadedImages.length === 0) {
      setError('Subí al menos una imagen')
      return
    }

    setStep('processing')
    setError('')

    try {
      const body: any = { rubroId, email: session.user.email }

      if (inputMode === 'image' && activeImage) {
        body.imageBase64 = activeImage.base64
        body.mimeType = activeImage.mime
        // Para vinoteca: enviamos TODAS las fotos para guardarlas al banco
        if (rubroId === 'vinoteca') {
          body.allUploads = uploadedImages.map(u => ({ base64: u.base64, mime: u.mime }))
          body.uploadCount = uploadedImages.length
        }
      } else {
        body.formData = formValues
      }

      const res = await fetch('/api/process-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (res.status === 403 && data.code === 'LIMIT_REACHED') {
        setShowUpgrade(true); setStep('input'); return
      }
      if (!res.ok) throw new Error(data.error || 'Error al procesar')

      // Las fotos subidas van siempre primero, directamente desde las previews locales
      // El API devuelve solo fotos del banco + Pexels (sin marcadores)
      const userPreviews = uploadedImages.map(u => u.preview)
      const apiImages: string[] = (data.images || []).filter(Boolean)
      const resolvedImages = [...userPreviews, ...apiImages]

      setResult({ ...data, images: resolvedImages })
      setPhotoList(resolvedImages)
      setSelectedPhoto(resolvedImages[0] || '')
      setStep('result')
    } catch (err: any) {
      setError(err.message)
      setStep('input')
    }
  }

  // ── Canvas render ──────────────────────────────────────────────────────────
  const renderCanvas = useCallback(async () => {
    if (!result || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const W = 1080, H = 1080
    canvas.width = W; canvas.height = H

    const isVino = rubroId === 'vinoteca'
    const font = isVino ? '"Playfair Display", Georgia, serif' : 'Inter, sans-serif'

    if (isVino) {
      try { await document.fonts.load('900 80px "Playfair Display"') } catch {}
    }

    // ── Layout vinoteca: foto arriba (65%) + franja crema abajo (35%) ──
    if (isVino) {
      const PHOTO_H = Math.round(H * 0.65)
      const TEXT_H  = H - PHOTO_H

      // Fondo crema para la zona de texto
      ctx.fillStyle = '#FFFDF7'
      ctx.fillRect(0, 0, W, H)

      // Foto superior
      const photoUrl = selectedPhoto
        ? selectedPhoto.startsWith('data:') ? selectedPhoto
          : `/api/download-image?url=${encodeURIComponent(selectedPhoto)}`
        : null

      if (photoUrl) {
        try {
          const img = new window.Image()
          img.crossOrigin = 'anonymous'
          await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = photoUrl })

          const offscreen = document.createElement('canvas')
          offscreen.width = W; offscreen.height = PHOTO_H
          const offCtx = offscreen.getContext('2d')!
          if (currentFilter.css !== 'none') offCtx.filter = currentFilter.css
          const scale = Math.max(W / img.width, PHOTO_H / img.height)
          const dw = img.width * scale, dh = img.height * scale
          offCtx.drawImage(img, (W - dw) / 2, (PHOTO_H - dh) / 2, dw, dh)
          ctx.drawImage(offscreen, 0, 0)
        } catch {}
      }

      // Sutil vignette en el borde inferior de la foto
      const vig = ctx.createLinearGradient(0, PHOTO_H - 120, 0, PHOTO_H)
      vig.addColorStop(0, 'rgba(255,253,247,0)')
      vig.addColorStop(1, 'rgba(255,253,247,0.6)')
      ctx.fillStyle = vig
      ctx.fillRect(0, PHOTO_H - 120, W, 120)

      // Línea separadora muy sutil
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(60, PHOTO_H + 1)
      ctx.lineTo(W - 60, PHOTO_H + 1)
      ctx.stroke()

      // ── Texto en zona crema ──
      ctx.textAlign = 'center'
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0

      const centerX = W / 2
      const MAX_W = W - 120
      let textY = PHOTO_H + 62

      // MARCA — Playfair 900, negro, grande
      const marcaText = (result.line1 || '').toUpperCase()
      let fs = 84
      ctx.font = `900 ${fs}px ${font}`
      while (ctx.measureText(marcaText).width > MAX_W && fs > 36) {
        fs -= 4
        ctx.font = `900 ${fs}px ${font}`
      }
      ctx.fillStyle = '#1a1a1a'
      // Wrap en 2 líneas si sigue siendo largo
      const words = marcaText.split(' ')
      if (ctx.measureText(marcaText).width > MAX_W && words.length > 1) {
        const mid = Math.ceil(words.length / 2)
        const la = words.slice(0, mid).join(' ')
        const lb = words.slice(mid).join(' ')
        let fs2 = 68
        ctx.font = `900 ${fs2}px ${font}`
        const longest = la.length > lb.length ? la : lb
        while (ctx.measureText(longest).width > MAX_W && fs2 > 28) { fs2 -= 4; ctx.font = `900 ${fs2}px ${font}` }
        ctx.fillText(la, centerX, textY)
        textY += fs2 + 8
        ctx.fillText(lb, centerX, textY)
        textY += fs2 + 8
      } else {
        ctx.fillText(marcaText, centerX, textY)
        textY += fs + 8
      }

      // Línea fina decorativa
      ctx.strokeStyle = 'rgba(147,51,234,0.35)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(centerX - 80, textY + 8)
      ctx.lineTo(centerX + 80, textY + 8)
      ctx.stroke()
      textY += 28

      // varietal · categoría · año — italic, gris medio
      if (result.line2) {
        ctx.font = `italic 400 30px ${font}`
        ctx.fillStyle = '#888'
        ctx.fillText(result.line2, centerX, textY)
        textY += 44
      }

      // Precio — morado suave
      if (result.badge) {
        ctx.font = `600 28px ${font}`
        ctx.fillStyle = '#9333ea'
        ctx.fillText(result.badge, centerX, textY)
      }

      // Logo en esquina superior derecha
      if (showLogo && agencyLogo) {
        try {
          const logo = new window.Image()
          logo.crossOrigin = 'anonymous'
          await new Promise<void>((res, rej) => { logo.onload = () => res(); logo.onerror = rej; logo.src = agencyLogo })
          const LH = 52
          const lscale = LH / logo.height
          const lw = logo.width * lscale
          ctx.globalAlpha = 0.85
          ctx.drawImage(logo, W - lw - 28, 20, lw, LH)
          ctx.globalAlpha = 1
        } catch {}
      }

    } else {
      // ── Layout otros rubros: foto full + gradiente oscuro + texto abajo ──
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, W, H)

      const photoUrl = selectedPhoto
        ? selectedPhoto.startsWith('data:') ? selectedPhoto
          : `/api/download-image?url=${encodeURIComponent(selectedPhoto)}`
        : null

      if (photoUrl) {
        try {
          const img = new window.Image()
          img.crossOrigin = 'anonymous'
          await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = photoUrl })
          const offscreen = document.createElement('canvas')
          offscreen.width = W; offscreen.height = H
          const offCtx = offscreen.getContext('2d')!
          if (currentFilter.css !== 'none') offCtx.filter = currentFilter.css
          const scale = Math.max(W / img.width, H / img.height)
          const dw = img.width * scale, dh = img.height * scale
          offCtx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
          ctx.drawImage(offscreen, 0, 0)
        } catch {}
      }

      const grad = ctx.createLinearGradient(0, H * 0.35, 0, H)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(0.6, 'rgba(0,0,0,0.55)')
      grad.addColorStop(1, 'rgba(0,0,0,0.92)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      const line1 = (result.line1 || '').toUpperCase()
      const line2 = result.line2 || ''
      const priceLine = result.badge || ''

      ctx.fillStyle = 'white'
      ctx.textAlign = 'center'
      ctx.shadowColor = 'rgba(0,0,0,0.7)'
      ctx.shadowBlur = 12
      const MAX_W = W - 80

      let fs = 96
      ctx.font = `900 ${fs}px ${font}`
      while (ctx.measureText(line1).width > MAX_W && fs > 40) { fs -= 4; ctx.font = `900 ${fs}px ${font}` }

      let textY = H * 0.74
      const words = line1.split(' ')
      if (ctx.measureText(line1).width > MAX_W && words.length > 1) {
        const mid = Math.ceil(words.length / 2)
        const l1 = words.slice(0, mid).join(' ')
        const l2 = words.slice(mid).join(' ')
        let fs2 = 80
        ctx.font = `900 ${fs2}px ${font}`
        const longest = l1.length > l2.length ? l1 : l2
        while (ctx.measureText(longest).width > MAX_W && fs2 > 32) { fs2 -= 4; ctx.font = `900 ${fs2}px ${font}` }
        textY = H * 0.68
        ctx.fillText(l1, W / 2, textY)
        ctx.fillText(l2, W / 2, textY + fs2 + 10)
        textY = textY + fs2 + 10
      } else {
        ctx.fillText(line1, W / 2, textY)
      }

      if (line2) {
        ctx.shadowBlur = 0
        ctx.font = `700 42px ${font}`
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.fillText(line2, W / 2, textY + 54)
        textY = textY + 54
      }

      if (priceLine) {
        ctx.shadowBlur = 0
        ctx.font = `600 30px ${font}`
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.fillText(priceLine, W / 2, textY + 44)
      }

      if (showLogo && agencyLogo) {
        const BH = Math.round(H * 0.12)
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(0, 0, W, BH)
        try {
          const logo = new window.Image()
          logo.crossOrigin = 'anonymous'
          await new Promise<void>((res, rej) => { logo.onload = () => res(); logo.onerror = rej; logo.src = agencyLogo })
          const maxH = BH - 12
          const lscale = maxH / logo.height
          const lw = logo.width * lscale
          ctx.drawImage(logo, (W - lw) / 2, (BH - maxH) / 2, lw, maxH)
        } catch {}
      }

      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
    }
  }, [result, selectedPhoto, selectedFilter, showLogo, agencyLogo, currentFilter, rubroId])

  useEffect(() => {
    if (step === 'preview') renderCanvas()
  }, [step, renderCanvas])

  // ── Share ──────────────────────────────────────────────────────────────────
  const shareImage = async () => {
    if (!canvasRef.current) return
    await renderCanvas()
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.92)
    const text = result?.textInstagram || result?.textFacebook || ''
    try { await navigator.clipboard.writeText(text) } catch {}

    if (navigator.share) {
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'post.jpg', { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text })
        return
      }
    }
    const a = document.createElement('a')
    a.href = dataUrl; a.download = `post-${rubroId}.jpg`; a.click()
    alert('✅ Texto copiado. La imagen se descargó.')
  }

  const copyText = async () => {
    const text = activeTab === 'facebook' ? result?.textFacebook : result?.textInstagram
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROCESSING STEP
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-6 animate-bounce">{rubro.emoji}</div>
          <p className="text-white text-xl font-bold mb-2">Analizando con IA...</p>
          <p className="text-slate-400 text-sm">Generando tu post para {rubro.label}</p>
          <div className="mt-8 flex gap-2 justify-center">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-white animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PREVIEW STEP
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'preview') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4">
        <canvas ref={canvasRef} className="hidden" />
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-3 mb-6 pt-4">
            <button onClick={() => setStep('result')} className="text-slate-400 hover:text-white transition text-sm">← Volver</button>
            <span className="text-white font-bold text-lg">Vista previa</span>
          </div>

          {/* Live preview */}
          {rubroId === 'vinoteca' ? (
            /* ── Vinoteca: layout split foto + franja crema ── */
            <div className="w-full rounded-2xl overflow-hidden shadow-2xl mb-4 bg-[#FFFDF7]" style={{ aspectRatio: '1/1' }}>
              {/* Foto superior 65% */}
              <div className="relative w-full" style={{ height: '65%' }}>
                {selectedPhoto && (
                  <img src={selectedPhoto} alt="foto"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ filter: currentFilter.css !== 'none' ? currentFilter.css : undefined }} />
                )}
                {/* Vignette sutil en borde inferior */}
                <div className="absolute bottom-0 left-0 right-0 h-16"
                  style={{ background: 'linear-gradient(to bottom, rgba(255,253,247,0), rgba(255,253,247,0.6))' }} />
                {/* Logo esquina superior derecha */}
                {showLogo && agencyLogo && (
                  <img src={agencyLogo} alt="logo"
                    className="absolute top-2 right-2 h-7 object-contain opacity-85 max-w-[100px]" />
                )}
              </div>
              {/* Franja crema 35%: marca + info */}
              <div className="flex flex-col items-center justify-center px-4 pt-3 pb-4"
                style={{ height: '35%', fontFamily: overlayFont }}>
                <p className="font-black text-gray-900 leading-tight text-center break-words w-full"
                  style={{ fontSize: 'clamp(18px, 6vw, 38px)' }}>
                  {result?.line1?.toUpperCase()}
                </p>
                <div className="w-16 border-t border-purple-400/40 my-1.5" />
                {result?.line2 && (
                  <p className="text-gray-400 italic text-center" style={{ fontSize: 'clamp(9px, 2.5vw, 15px)' }}>
                    {result.line2}
                  </p>
                )}
                {result?.badge && (
                  <p className="text-purple-600 font-semibold mt-0.5" style={{ fontSize: 'clamp(9px, 2.2vw, 14px)' }}>
                    {result.badge}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* ── Otros rubros: foto full + gradiente oscuro ── */
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden shadow-2xl bg-gray-900 mb-4">
              {selectedPhoto && (
                <img src={selectedPhoto} alt="foto"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ filter: currentFilter.css !== 'none' ? currentFilter.css : undefined }} />
              )}
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.92) 100%)' }} />
              {showLogo && agencyLogo && (
                <div className="absolute top-0 left-0 right-0 bg-black/55 flex items-center justify-center" style={{ height: '12%' }}>
                  <img src={agencyLogo} alt="logo" className="h-full py-1 max-w-[260px] object-contain" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 text-center text-white"
                style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)', fontFamily: overlayFont }}>
                <p className="font-black break-words w-full leading-tight"
                  style={{ fontSize: 'clamp(22px, 7.5vw, 48px)' }}>
                  {result?.line1?.toUpperCase()}
                </p>
                {result?.line2 && (
                  <p className="mt-1" style={{ fontSize: 'clamp(11px, 3.2vw, 19px)', fontWeight: 700, opacity: 0.88 }}>
                    {result.line2}
                  </p>
                )}
                {result?.badge && (
                  <p className="mt-1" style={{ fontSize: 'clamp(10px, 2.5vw, 15px)', opacity: 0.7, fontWeight: 500 }}>
                    {result.badge}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="bg-white/10 rounded-2xl p-4 mb-4 space-y-4">
            {/* Filtros */}
            <div>
              <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Filtro</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {FILTERS.map(f => (
                  <button key={f.id} onClick={() => setSelectedFilter(f.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${selectedFilter === f.id ? 'bg-white text-slate-900' : 'bg-white/20 text-white hover:bg-white/30'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Logo toggle */}
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-sm">Mostrar logo</span>
              <button onClick={() => setShowLogo(v => !v)}
                className={`w-12 h-6 rounded-full transition-colors ${showLogo ? 'bg-green-500' : 'bg-slate-600'}`}>
                <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${showLogo ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Logo upload */}
            <div className="flex items-center gap-3">
              {agencyLogo && <img src={agencyLogo} alt="logo" className="h-8 object-contain" />}
              <button onClick={() => logoInputRef.current?.click()}
                className="text-slate-400 text-sm hover:text-white transition underline">
                {agencyLogo ? 'Cambiar logo' : 'Subir logo'}
              </button>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>

          {/* Photo grid */}
          {photoList.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Elegí la foto</p>
                <p className="text-slate-500 text-xs">Tocá ✕ para sacar las que no te gustan</p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {photoList.map((url, i) => {
                  const isDataUrl = url.startsWith('data:')
                  const isSavedPhoto = !isDataUrl && url.includes('supabase')
                  const isSelected = selectedPhoto === url
                  return (
                    <div key={i} className="relative aspect-square">
                      <button onClick={() => setSelectedPhoto(url)}
                        className={`w-full h-full rounded-xl overflow-hidden border-2 transition block ${isSelected ? 'border-white' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        {isDataUrl && (
                          <span className="absolute top-1 left-1 bg-purple-600 text-white text-[9px] px-1 rounded font-bold">NUEVA</span>
                        )}
                        {isSavedPhoto && (
                          <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] px-1 rounded font-bold">📚</span>
                        )}
                      </button>
                      {/* X para borrar de la lista */}
                      <button
                        onClick={() => {
                          const next = photoList.filter((_, j) => j !== i)
                          setPhotoList(next)
                          if (isSelected) setSelectedPhoto(next[0] || '')
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow transition z-10">
                        ✕
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <button onClick={shareImage}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl text-lg transition active:scale-95 shadow-lg">
            📲 Guardar y compartir
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESULT STEP
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'result' && result) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4">
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between pt-4 mb-6">
            <button onClick={() => setStep('input')} className="text-slate-400 hover:text-white transition text-sm">← Nuevo post</button>
            <span className="text-slate-400 text-sm">{rubro.emoji} {rubro.label}</span>
          </div>

          {/* Detected info */}
          <div className="bg-white/10 rounded-2xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{rubro.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-lg leading-tight break-words"
                  style={{ fontFamily: rubroId === 'vinoteca' ? overlayFont : undefined }}>
                  {result.line1}
                </p>
                {result.line2 && <p className="text-slate-300 text-sm mt-0.5"
                  style={{ fontStyle: rubroId === 'vinoteca' ? 'italic' : 'normal' }}>
                  {result.line2}
                </p>}
                {result.badge && (
                  <span className="inline-block bg-white/20 text-white text-xs px-2 py-0.5 rounded-full mt-1">{result.badge}</span>
                )}
              </div>
            </div>
          </div>

          {/* Secciones estructuradas vinoteca: enólogo + historia + CTA */}
          {rubroId === 'vinoteca' && (result.enologist || result.story) && (
            <div className="space-y-3 mb-4">
              {result.enologist && (
                <div className="bg-purple-900/30 border border-purple-500/20 rounded-2xl p-4">
                  <p className="text-purple-300 text-xs font-bold uppercase tracking-widest mb-2">🍷 Notas del enólogo</p>
                  <p className="text-slate-200 text-sm leading-relaxed">{result.enologist}</p>
                </div>
              )}
              {result.story && (
                <div className="bg-rose-900/20 border border-rose-500/20 rounded-2xl p-4">
                  <p className="text-rose-300 text-xs font-bold uppercase tracking-widest mb-2">✨ Historia y maridaje</p>
                  <p className="text-slate-200 text-sm leading-relaxed">{result.story}</p>
                </div>
              )}
              {result.cta && (
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-center">
                  <p className="text-slate-300 text-sm font-medium">{result.cta}</p>
                </div>
              )}
            </div>
          )}

          {/* Text tabs */}
          <div className="bg-white/10 rounded-2xl p-4 mb-4">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Texto para copiar</p>
            <div className="flex gap-2 mb-3">
              {(['facebook', 'instagram'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${activeTab === tab ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                  {tab === 'facebook' ? '👍 Facebook' : '📸 Instagram'}
                </button>
              ))}
            </div>
            <div className="bg-black/30 rounded-xl p-3 relative">
              <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                {activeTab === 'facebook' ? result.textFacebook : result.textInstagram}
              </p>
              <button onClick={copyText}
                className="absolute top-2 right-2 text-xs text-slate-400 hover:text-white bg-white/10 px-2 py-1 rounded-lg transition">
                {copied ? '✅ Copiado' : '📋 Copiar'}
              </button>
            </div>
          </div>

          <button onClick={() => setStep('preview')}
            className={`w-full bg-gradient-to-r ${rubro.color} text-white font-bold py-4 rounded-2xl text-lg transition active:scale-95 shadow-lg`}>
            🖼️ Armar imagen del post →
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INPUT STEP
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4">
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}

      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between pt-4 mb-6">
          <button onClick={() => router.push('/')} className="text-slate-400 hover:text-white transition text-sm">← Cambiar rubro</button>
          <div className="flex items-center gap-2">
            {session?.user ? (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs truncate max-w-[140px]">{session.user.email || session.user.name}</span>
                <button onClick={() => signOut()} className="text-slate-500 text-xs hover:text-white transition">Salir</button>
              </div>
            ) : (
              <button onClick={() => signIn('facebook')}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition">
                Iniciar sesión
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <span className="text-5xl">{rubro.emoji}</span>
          <h1 className="text-2xl font-black text-white mt-2">{rubro.ctaText}</h1>
          <p className="text-slate-400 text-sm mt-1">{rubro.description}</p>
          {rubroId === 'vinoteca' && (
            <button onClick={() => router.push('/biblioteca')}
              className="mt-2 text-purple-400 hover:text-purple-300 text-xs underline transition">
              📚 Ver mi biblioteca de vinos
            </button>
          )}
        </div>

        {/* Input mode toggle */}
        {rubro.inputType === 'both' && (
          <div className="flex gap-2 mb-4 bg-white/10 p-1 rounded-xl">
            <button onClick={() => setInputMode('image')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${inputMode === 'image' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
              📷 Subir imagen
            </button>
            <button onClick={() => setInputMode('form')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${inputMode === 'form' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
              ✏️ Completar datos
            </button>
          </div>
        )}

        {/* Image upload zone */}
        {(inputMode === 'image' || rubro.inputType === 'image') && (
          <div className="mb-4">
            {/* Drop zone */}
            <div ref={dropZoneRef} onDrop={handleFileDrop} onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-600 hover:border-slate-400 rounded-2xl p-6 text-center cursor-pointer transition">
              <div className="text-3xl mb-2">📷</div>
              <p className="text-white font-semibold text-sm mb-0.5">{rubro.imageLabel}</p>
              <p className="text-slate-500 text-xs">Arrastrá, tocá para subir, o <kbd className="bg-slate-700 text-slate-300 px-1 rounded text-xs">Ctrl+V</kbd> para pegar screenshot</p>
              <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment"
                className="hidden" onChange={handleFileChange} />
            </div>

            {/* Thumbnails of uploaded images */}
            {uploadedImages.length > 0 && (
              <div className="mt-3">
                <p className="text-slate-400 text-xs mb-2">
                  Fotos subidas · <span className="text-slate-300">La IA analiza la que está marcada</span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  {uploadedImages.map((img, i) => (
                    <div key={i} className="relative">
                      <button onClick={() => setActiveUploadIdx(i)}
                        className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition ${activeUploadIdx === i ? 'border-white' : 'border-transparent opacity-60 hover:opacity-90'}`}>
                        <img src={img.preview} alt="" className="w-full h-full object-cover" />
                      </button>
                      {activeUploadIdx === i && (
                        <span className="absolute -top-1.5 -right-1.5 bg-white text-slate-900 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">✓</span>
                      )}
                      <button onClick={() => removeImage(i)}
                        className="absolute -bottom-1.5 -right-1.5 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center hover:bg-red-600 transition">
                        ✕
                      </button>
                    </div>
                  ))}
                  {/* Add more */}
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-600 hover:border-slate-400 flex items-center justify-center text-slate-500 hover:text-white transition text-2xl">
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        {inputMode === 'form' && rubro.inputType !== 'image' && (
          <div className="space-y-3 mb-4">
            {rubro.formFields.map(field => (
              <div key={field.key}>
                <label className="text-slate-300 text-sm font-semibold block mb-1">
                  {field.label}{field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea placeholder={field.placeholder} value={formValues[field.key] || ''}
                    onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.value }))}
                    rows={3} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-white/40 resize-none" />
                ) : field.type === 'select' ? (
                  <select value={formValues[field.key] || ''}
                    onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/40">
                    <option value="">Seleccionar...</option>
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input type={field.type} placeholder={field.placeholder} value={formValues[field.key] || ''}
                    onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-white/40" />
                )}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-300 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>
        )}

        <button onClick={handleProcess} disabled={false}
          className={`w-full bg-gradient-to-r ${rubro.color} text-white font-black py-4 rounded-2xl text-lg transition active:scale-95 shadow-lg disabled:opacity-50`}>
          {session?.user ? '✨ Generar post con IA' : '🔑 Iniciar sesión para continuar'}
        </button>

        {!result?.isPro && result && (
          <p className="text-center text-slate-500 text-xs mt-3">{result.usedCount}/10 posts gratuitos usados este mes</p>
        )}
      </div>
    </div>
  )
}

// ─── Page with Suspense ───────────────────────────────────────────────────────
export default function CrearPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    }>
      <CrearInner />
    </Suspense>
  )
}
