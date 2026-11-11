// Transactional mail (verification + password reset) through the host's Postfix.
// SMTP_URL e.g. smtp://host.docker.internal:25 ; MAIL_FROM e.g. "LifeSOC <no-reply@lifesoc.app>".
// SMTP_TLS_SERVERNAME: the name on Postfix's certificate. The container reaches
// the host as host.docker.internal, so STARTTLS must ask for (and verify) the
// box's real hostname instead.
import './_env.js'
import nodemailer from 'nodemailer'

const FROM = process.env.MAIL_FROM ?? 'LifeSOC <no-reply@lifesoc.app>'

function smtpOptions(raw) {
  const u = new URL(raw)
  return {
    host: u.hostname,
    port: Number(u.port || (u.protocol === 'smtps:' ? 465 : 25)),
    secure: u.protocol === 'smtps:',
    ...(u.username ? { auth: { user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password) } } : {}),
    tls: {
      servername: process.env.SMTP_TLS_SERVERNAME || u.hostname,
      rejectUnauthorized: process.env.SMTP_VERIFY_PEER !== 'false',
    },
  }
}

const transport = process.env.SMTP_URL ? nodemailer.createTransport(smtpOptions(process.env.SMTP_URL)) : null

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export async function sendMail({ to, subject, intro, quote, actionText, url, outro, replyTo }) {
  const text = `${intro}\n\n${quote ? `${quote}\n\n` : ''}${actionText}:\n${url}\n\n${outro}\n\n— LifeSOC`
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#0d1117;font-family:system-ui,sans-serif;color:#e6edf3">
<div style="max-width:480px;margin:0 auto;background:#161b22;border:1px solid #30363d;border-radius:12px;padding:28px">
<h1 style="font-size:18px;margin:0 0 16px">LifeSOC</h1>
<p style="line-height:1.5;margin:0 0 20px">${escape(intro)}</p>
${quote ? `<div style="margin:0 0 20px;padding:12px 14px;border-left:3px solid #2f81f7;background:#0d1117;border-radius:6px;white-space:pre-wrap;line-height:1.5">${escape(quote)}</div>` : ''}
<p style="margin:0 0 20px"><a href="${escape(url)}" style="display:inline-block;background:#2f81f7;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${escape(actionText)}</a></p>
<p style="line-height:1.5;margin:0;color:#8b949e;font-size:13px">${escape(outro)}</p>
</div></body></html>`

  if (!transport) {
    // Local development only: never log live links in production.
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP_URL is not configured')
    console.log(`[mail] (not sent, no SMTP_URL) to=${to} subject="${subject}" url=${url}`)
    return
  }
  await transport.sendMail({ from: FROM, to, subject, text, html, ...(replyTo ? { replyTo } : {}) })
}
