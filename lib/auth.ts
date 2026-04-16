import { NextAuthOptions } from 'next-auth'
import FacebookProvider from 'next-auth/providers/facebook'

export const authOptions: NextAuthOptions = {
  providers: [
    FacebookProvider({
      clientId: process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
      authorization: {
        params: {
          scope: 'public_profile,email',
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        // Usamos sub (Facebook user ID) como identificador único
        session.user.email = token.email as string || `fb_${token.sub}`
      }
      return session
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        // Intentar email, si no usar ID de Facebook como fallback
        token.email = (profile as any).email || `fb_${(profile as any).id || token.sub}`
      }
      return token
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
