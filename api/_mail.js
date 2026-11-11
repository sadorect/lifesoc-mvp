// Transactional mail (verification + password reset) through the host's Postfix.
// SMTP_URL e.g. smtp://host.docker.internal:25 ; MAIL_FROM e.g. "LifeSOC <no-reply@lifesoc.app>".
import './_env.js'
import nodemailer from 'nodemailer'

const FROM = process.env.MAIL_FROM ?? 'LifeSOC <no-reply@lifesoc.app>'
const transport = process.env.SMTP_URL
  ? nodemailer.createTransport(process.env.SMTP_URL, {
      // Postfix's STARTTLS cert names the box's hostname, not the container's view of it.
      tls: { rejectUnauthorized: process.env.SMTP_VERIFY_PEER === 'true' },
    })
  : null

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export async function sendMail({ to, subject, intro, actionText, url, outro }) {
  const text = `${intro}\n\n${actionText}:\n${url}\n\n${outro}\n\n— LifeSOC`
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#0d1117;font-family:system-ui,sans-serif;color:#e6edf3">
<div style="max-width:480px;margin:0 auto;background:#161b22;border:1px solid #30363d;border-radius:12px;padding:28px">
<h1 style="font-size:18px;margin:0 0 16px">LifeSOC</h1>
<p style="line-height:1.5;margin:0 0 20px">${escape(intro)}</p>
<p style="margin:0 0 20px"><a href="${escape(url)}" style="display:inline-block;background:#2f81f7;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${escape(actionText)}</a></p>
<p style="line-height:1.5;margin:0;color:#8b949e;font-size:13px">${escape(outro)}</p>
</div></body></html>`

  if (!transport) {
    // Local development only: never log live links in production.
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP_URL is not configured')
    console.log(`[mail] (not sent, no SMTP_URL) to=${to} subject="${subject}" url=${url}`)
    return
  }
  await transport.sendMail({ from: FROM, to, subject, text, html })
}
