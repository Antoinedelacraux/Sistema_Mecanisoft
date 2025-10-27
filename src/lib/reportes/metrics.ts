type MetricsShape = {
  jobsStarted: number
  jobsCompleted: number
  jobsFailed: number
  filesGenerated: number
  jobsEnqueued: number
  fallbackRuns: number
  processingRuns: number
  processingMsTotal: number
}

const metrics: MetricsShape = {
  jobsStarted: 0,
  jobsCompleted: 0,
  jobsFailed: 0,
  filesGenerated: 0,
  jobsEnqueued: 0,
  fallbackRuns: 0,
  processingRuns: 0,
  processingMsTotal: 0,
}

export function inc(name: keyof MetricsShape, by = 1) {
  (metrics[name] as number) += by
}

export function getMetrics() {
  const avg = metrics.processingRuns > 0 ? metrics.processingMsTotal / metrics.processingRuns : 0
  return { ...metrics, processingMsAvg: avg }
}

export default { inc, getMetrics }
