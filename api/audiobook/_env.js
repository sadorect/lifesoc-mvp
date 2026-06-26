// Loads .env.local for local `vercel dev`. No-op in production, where Vercel
// injects real env vars (dotenv won't override already-set process.env keys).
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })
