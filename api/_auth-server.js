// Self-hosted sign-in (replaces Clerk): email + password and Google, with
// sessions in an HttpOnly cookie. Mounted at /api/auth/* by selfhost/server.js.
import './_env.js'
import bcrypt from 'bcryptjs'
import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { getMigrations } from 'better-auth/db/migration'
import { db } from './_db.js'
import { sendMail } from './_mail.js'
import { signupsPaused } from './_settings.js'

if (!process.env.BETTER_AUTH_SECRET) throw new Error('Missing BETTER_AUTH_SECRET')

const extraOrigins = String(process.env.EXTRA_AUTHORIZED_PARTIES ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean)

const google = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
  : {}

export const googleEnabled = Object.keys(google).length > 0

export const auth = betterAuth({
  appName: 'LifeSOC',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  database: db,
  trustedOrigins: [
    'https://www.lifesoc.app',
    'https://lifesoc.app',
    'http://localhost:5173',
    'http://localhost:3000',
    ...extraOrigins,
  ],

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: hashPassword,
      // Readers imported from Clerk keep their bcrypt hashes; new and reset
      // passwords use Better Auth's default (scrypt).
      verify: async ({ hash, password }) =>
        /^\$2[aby]\$/.test(hash) ? bcrypt.compare(password, hash) : verifyPassword({ hash, password }),
    },
    sendResetPassword: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: 'Reset your LifeSOC password',
        intro: 'Someone (hopefully you) asked to reset the password for your LifeSOC account.',
        actionText: 'Choose a new password',
        url,
        outro: "This link expires in 1 hour. If you didn't ask for it, you can ignore this email.",
      })
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true, // an unverified reader who tries to sign in gets a fresh link
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: 'Confirm your email for LifeSOC',
        intro: 'Welcome to LifeSOC, the companion app for Zero Trust. Confirm your email address to finish signing up.',
        actionText: 'Confirm email',
        url,
        outro: "If you didn't create a LifeSOC account, you can ignore this email.",
      })
    },
  },

  socialProviders: google,

  account: {
    // "Continue with Google" lands on the existing account with the same verified email.
    accountLinking: { enabled: true, trustedProviders: ['google'] },
  },

  // Admin setting: pause new accounts (email and Google). Existing readers are unaffected.
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          if (signupsPaused()) throw new APIError('FORBIDDEN', { message: 'New sign-ups are paused', code: 'SIGNUPS_PAUSED' })
        },
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,      // refreshed at most daily
  },

  rateLimit: {
    enabled: process.env.NODE_ENV === 'production' || process.env.AUTH_RATE_LIMIT === 'true',
    window: 60,
    max: 60,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 300, max: 5 },
      '/request-password-reset': { window: 300, max: 3 },
      '/send-verification-email': { window: 300, max: 3 },
    },
  },

  advanced: {
    // The origin only accepts traffic from Cloudflare, which sets this header.
    ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] },
  },
})

// Create or extend Better Auth's tables on boot. Additive only: getMigrations
// throws rather than run anything destructive.
const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options)
if (toBeCreated.length || toBeAdded.length) {
  await runMigrations()
  console.log(`[auth] migrated: created ${toBeCreated.map((t) => t.table).join(', ') || 'none'}; extended ${toBeAdded.map((t) => t.table).join(', ') || 'none'}`)
}
