import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import { Movement, RepMaxType, Unit, PR } from '../../types'

interface PRProgressChartProps {
  movement: Movement
  prs: PR[]
  repMax?: RepMaxType
  unit: Unit
}

export function PRProgressChart({ movement, prs, repMax, unit }: PRProgressChartProps) {
  // Filter and sort PRs for this movement and rep max
  const filteredPRs = prs
    .filter(pr => pr.movement === movement && (!repMax || pr.repMax === repMax))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  if (filteredPRs.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Progress Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            <div className="text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No progress data yet</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Prepare chart data
  const chartData = filteredPRs.map((pr, index) => {
    let displayValue: number
    
    if (unit === Unit.TIME && typeof pr.value === 'string') {
      // Convert time string (mm:ss) to total seconds for chart display
      const [minutes, seconds] = pr.value.split(':').map(Number)
      displayValue = minutes * 60 + seconds
    } else if (typeof pr.value === 'number') {
      displayValue = pr.value
    } else {
      displayValue = 0
    }

    return {
      date: format(pr.date, 'MMM dd'),
      value: displayValue,
      originalValue: pr.value,
      fullDate: pr.date,
      id: pr.id,
    }
  })

  const formatTooltipValue = (value: number) => {
    if (unit === Unit.TIME) {
      const minutes = Math.floor(value / 60)
      const seconds = value % 60
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
    return `${value} ${unit}`
  }

  const formatYAxisValue = (value: number) => {
    if (unit === Unit.TIME) {
      const minutes = Math.floor(value / 60)
      return `${minutes}:${(value % 60).toString().padStart(2, '0')}`
    }
    return value.toString()
  }

  // Determine line color based on rep max
  const getLineColor = () => {
    switch (repMax) {
      case RepMaxType.ONE_RM:
        return '#ef4444' // red
      case RepMaxType.THREE_RM:
        return '#f97316' // orange
      case RepMaxType.FIVE_RM:
        return '#eab308' // yellow
      case RepMaxType.TEN_RM:
        return '#22c55e' // green
      default:
        return '#3b82f6' // blue
    }
  }

  const improvement = filteredPRs.length > 1 
    ? ((chartData[chartData.length - 1].value - chartData[0].value) / chartData[0].value * 100).toFixed(1)
    : '0'

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Progress Chart</span>
          {filteredPRs.length > 1 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {improvement}% improvement
            </span>
          )}
        </CardTitle>
        {repMax && (
          <p className="text-xs text-muted-foreground">{repMax} Progress</p>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fontSize: 10 }}
              tickFormatter={formatYAxisValue}
            />
            <Tooltip
              formatter={(value: number) => [formatTooltipValue(value), 'PR']}
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px'
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={getLineColor()}
              strokeWidth={2}
              dot={{ fill: getLineColor(), strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}