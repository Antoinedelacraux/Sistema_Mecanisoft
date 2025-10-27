export async function captureException(err: any) {
  if (!process.env.SENTRY_DSN) return
  try {
  // dynamic import to avoid hard dependency
  // @ts-ignore - @sentry/node is optional at runtime and may not be installed in all environments
  const Sentry = await import('@sentry/node')
    if (!Sentry.getCurrentHub().getClient()) {
      Sentry.init({ dsn: process.env.SENTRY_DSN })
    }
    Sentry.captureException(err)
  } catch (e) {
    // ignore if sentry not installed or fails
    console.warn('[sentry] capture failed', e)
  }
}

export default { captureException }
