import type { Metadata } from 'next'
import './globals.css'
import Providers from './providers'
import { inter, playfair, bebasNeue, caveat } from '@/lib/fonts'

export const metadata: Metadata = {
  title: 'PostPro — Posts profesionales para tu negocio',
  description: 'Creá posts para redes sociales en segundos con IA. Para inmobiliarias, restaurantes, vinotecas y agencias de viajes.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={`${inter.className} ${playfair.variable} ${bebasNeue.variable} ${caveat.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
