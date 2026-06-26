/**
 * One-time: set the CORS policy on the R2 bucket so browsers can fetch
 * audio segments directly from R2. Add your production domain to ALLOWED
 * when you deploy, then re-run.
 *
 * Run: node scripts/set-r2-cors.mjs
 */

import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const ALLOWED = [
  'http://localhost:5173',
  'http://localhost:3000',
  // 'https://your-app.vercel.app',   ← add production domain after deploy
]

const s3 = new S3Client({
  region:   'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

await s3.send(new PutBucketCorsCommand({
  Bucket: process.env.R2_BUCKET,
  CORSConfiguration: {
    CORSRules: [{
      AllowedOrigins: ALLOWED,
      AllowedMethods: ['GET', 'HEAD'],
      AllowedHeaders: ['*'],
      ExposeHeaders:  ['Content-Length', 'Content-Range'],
      MaxAgeSeconds:  3600,
    }],
  },
}))

console.log('R2 CORS policy set for:')
ALLOWED.forEach(o => console.log('  ', o))
