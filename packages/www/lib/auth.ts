import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import db from '@sabi/database'
import { nextCookies } from 'better-auth/next-js'

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  trustedOrigins: ["http://localhost:8080", "https://www.app.heysabi.com", "http://localhost:3000"],
  database: drizzleAdapter(db, {
    provider: "pg"
  }),
  plugins: [nextCookies()]
})     