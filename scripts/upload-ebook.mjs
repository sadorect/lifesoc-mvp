/**
 * Upload the ebook PDF to R2 at ebook/zerotrust.pdf.
 *
 * Place your PDF at:  ebook_src/zerotrust.pdf   (relative to project root)
 * then run:           node scripts/upload-ebook.mjs
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createReadStream, existsSync } from 'fs'
import { join, dirname }               from 'path'
import { fileURLToPath }               from 'url'
import dotenv                          from 'dotenv'

dotenv.config({ path: '.env.local' })

const __dirname = dirname(fileURLToPath(import.meta.url))
const PDF_PATH  = join(__dirname, '..', 'ebook_src', 'zerotrust.pdf')
const R2_KEY    = 'ebook/zerotrust.pdf'

if (!existsSync(PDF_PATH)) {
  console.error(`PDF not found at: ${PDF_PATH}`)
  console.error('Drop your ebook there as zerotrust.pdf and re-run.')
  process.exit(1)
}

const s3 = new S3Client({
  region:   'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

await s3.send(new PutObjectCommand({
  Bucket:      process.env.R2_BUCKET,
  Key:         R2_KEY,
  Body:        createReadStream(PDF_PATH),
  ContentType: 'application/pdf',
}))

console.log(`✓ Uploaded to ${R2_KEY}`)
