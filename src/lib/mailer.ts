import nodemailer from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer'

let cachedTransporter: nodemailer.Transporter | null = null

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter

  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587
  const secure = process.env.SMTP_SECURE === 'true'
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host) {
    throw new Error('SMTP_HOST no está configurado. Define las variables SMTP_* para habilitar el envío de correos.')
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined
  })

  return cachedTransporter
}

export async function sendMail(options: Mail.Options) {
  const transporter = getTransporter()
  return transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'makro02mc@gmail.com',
    ...options
  })
}
