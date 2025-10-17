import { ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type KpiCardProps = {
  title: string
  value: string
  helper?: string | ReactNode
  icon?: ReactNode
  trendLabel?: string
  trendValue?: number | null
}

const formatTrend = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return null
  }
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${(value * 100).toFixed(1)}%`
}

export const KpiCard = ({ title, value, helper, icon, trendLabel, trendValue }: KpiCardProps) => {
  const trend = formatTrend(trendValue)

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {trendLabel && trend && (
            <CardDescription className={`text-xs font-medium ${trendValue && trendValue < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {trendLabel}: {trend}
            </CardDescription>
          )}
        </div>
        {icon && <div className="text-blue-500">{icon}</div>}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {helper && <div className="mt-1 text-xs text-muted-foreground">{helper}</div>}
      </CardContent>
    </Card>
  )
}
