'use client'
import { useRouter } from 'next/navigation'
import { RUBRO_LIST, RubroId } from '@/lib/rubros'

export default function Home() {
  const router = useRouter()

  const handleSelect = (id: RubroId) => {
    router.push(`/crear?rubro=${id}`)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">
            Post<span className="text-yellow-400">Pro</span>
          </h1>
          <p className="text-slate-300 text-lg">
            Posts profesionales para redes sociales en segundos
          </p>
          <p className="text-slate-500 text-sm mt-2">Elegí tu rubro para empezar</p>
        </div>

        {/* Rubro Grid */}
        <div className="grid grid-cols-2 gap-4">
          {RUBRO_LIST.map((rubro) => (
            <button
              key={rubro.id}
              onClick={() => handleSelect(rubro.id)}
              className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-200 hover:scale-105 hover:shadow-2xl active:scale-95 bg-white/10 backdrop-blur border border-white/10 hover:border-white/30"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${rubro.color} opacity-0 group-hover:opacity-20 transition-opacity duration-200`} />
              <div className="relative z-10">
                <span className="text-4xl block mb-3">{rubro.emoji}</span>
                <h2 className="text-xl font-bold text-white mb-1">{rubro.label}</h2>
                <p className="text-slate-400 text-sm leading-snug">{rubro.description}</p>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${rubro.color} opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />
            </button>
          ))}
        </div>

        <p className="text-center text-slate-600 text-xs mt-10">
          postpro.app · Powered by IA
        </p>
      </div>
    </main>
  )
}
