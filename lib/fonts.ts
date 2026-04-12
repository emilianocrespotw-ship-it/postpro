import { Inter, Playfair_Display } from 'next/font/google'

export const inter = Inter({ subsets: ['latin'] })

export const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
})
