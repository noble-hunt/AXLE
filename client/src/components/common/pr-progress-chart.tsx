import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import { Movement, RepMaxType, Unit, PR } from '../../types'

interface PRProgressChartProps {
  movement: Movement
  prs: PR[]
  repMax?: RepMaxType
  unit: Unit
  showRepMaxVariants?: boolean
  height?: number
  showCard?: boolean
}

// Helper to convert numeric rep max to RepMaxType enum
const mapRepMaxToEnum = (repMax: number | string | undefined): RepMaxType | undefined => {
  if (!repMax) return undefined
  
  // If it's already a RepMaxType string enum, return it
  if (Object.values(RepMaxType).includes(repMax as RepMaxType)) {
    return repMax as RepMaxType
  }
  
  // Otherwise, try to parse it as a number and map to enum
  const num = typeof repMax === 'number' ? repMax : parseInt(String(repMax))
  switch (num) {
    case 1: return RepMaxType.ONE_RM
    case 3: return RepMaxType.THREE_RM
    case 5: return RepMaxType.FIVE_RM
    case 10: return RepMaxType.TEN_RM
    case 20: return RepMaxType.TWENTY_RM
    default: return undefined
  }
}

export function PRProgressChart({ movement, prs, repMax, unit, showRepMaxVariants = false, height = 150, showCard = true }: PRProgressChartProps) {
  // Filter and sort ALL PRs for this movement
  const filteredPRs = prs
    .filter(pr => pr.movement === movement)
    .sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date)
      const dateB = b.date instanceof Date ? b.date : new Date(b.date)
      return dateA.getTime() - dateB.getTime()
    })

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

  // Convert value to number for chart
  const convertValueToNumber = (value: any): number => {
    if (unit === Unit.TIME) {
      const timeValue = String(value || '0:00')
      const parts = timeValue.split(':')
      const minutes = parts.length > 0 ? parseInt(parts[0]) || 0 : 0
      const seconds = parts.length > 1 ? parseInt(parts[1]) || 0 : 0
      return minutes * 60 + seconds
    } else if (typeof value === 'number') {
      return value
    } else {
      return typeof value === 'string' ? parseFloat(value) || 0 : 0
    }
  }

  // Process PRs into chart format with rep max grouping
  const processedPRs = filteredPRs.map((pr) => {
    const prDate = pr.date instanceof Date ? pr.date : new Date(pr.date)
    const prRepMaxEnum = mapRepMaxToEnum(pr.repMax)
    
    return {
      date: format(prDate, 'MMM dd, yyyy'),
      timestamp: prDate.getTime(),
      value: convertValueToNumber(pr.value),
      repMax: prRepMaxEnum,
    }
  })

  // Group by rep max if needed
  const chartData: any[] = []
  
  if (showRepMaxVariants) {
    // Group PRs by rep max
    const grouped = new Map<string, typeof processedPRs>()
    processedPRs.forEach(pr => {
      const key = pr.repMax || 'ALL'
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(pr)
    })

    // Collect all unique timestamps
    const allTimestamps = Array.from(new Set(processedPRs.map(p => p.timestamp))).sort((a, b) => a - b)
    
    // Build chart data with a row for each timestamp
    allTimestamps.forEach(ts => {
      const row: any = {
        date: processedPRs.find(p => p.timestamp === ts)?.date || '',
        timestamp: ts
      }
      
      // For each rep max group, add the value if it exists for this timestamp
      grouped.forEach((groupPRs, repMaxKey) => {
        const prAtTimestamp = groupPRs.find(p => p.timestamp === ts)
        row[repMaxKey] = prAtTimestamp ? prAtTimestamp.value : undefined
      })
      
      chartData.push(row)
    })
  } else {
    // Simple case - all PRs in one line
    processedPRs.forEach(pr => {
      chartData.push({
        date: pr.date,
        timestamp: pr.timestamp,
        value: pr.value
      })
    })
  }

  // Get unique rep max groups for rendering lines
  const repMaxGroups = showRepMaxVariants 
    ? Array.from(new Set(processedPRs.map(pr => pr.repMax || 'ALL')))
    : []

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

  // Get color for a specific rep max
  const getRepMaxColor = (rm?: RepMaxType) => {
    switch (rm) {
      case RepMaxType.ONE_RM:
        return '#ef4444' // red
      case RepMaxType.THREE_RM:
        return '#f97316' // orange
      case RepMaxType.FIVE_RM:
        return '#eab308' // yellow
      case RepMaxType.TEN_RM:
        return '#22c55e' // green
      case RepMaxType.TWENTY_RM:
        return '#8b5cf6' // purple
      default:
        return '#3b82f6' // blue (default for non-weight movements)
    }
  }

  // Get rep max label for display
  const getRepMaxLabel = (rm?: RepMaxType) => {
    if (!rm) return 'All PRs'
    switch (rm) {
      case RepMaxType.ONE_RM: return '1RM'
      case RepMaxType.THREE_RM: return '3RM'
      case RepMaxType.FIVE_RM: return '5RM'
      case RepMaxType.TEN_RM: return '10RM'
      case RepMaxType.TWENTY_RM: return '20RM'
      default: return 'All PRs'
    }
  }

  const chartContent = (
    <ResponsiveContainer width="100%" height={height}>
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
              formatter={(value: number, name: string) => {
                if (value === null) return [null, name]
                return [formatTooltipValue(value), name]
              }}
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px'
              }}
            />
            {showRepMaxVariants && repMaxGroups.length > 0 ? (
              // Multiple lines - one for each rep max type
              repMaxGroups.map((repMaxKey) => {
                const repMaxEnum = repMaxKey !== 'ALL' ? (repMaxKey as RepMaxType) : undefined
                const color = getRepMaxColor(repMaxEnum)
                const label = getRepMaxLabel(repMaxEnum)
                
                return (
                  <Line
                    key={repMaxKey}
                    type="monotone"
                    dataKey={repMaxKey}
                    name={label}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ fill: color, r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                  />
                )
              })
            ) : (
              // Single line for all data
              <Line
                type="monotone"
                dataKey="value"
                name="PR"
                stroke={getRepMaxColor()}
                strokeWidth={2}
                dot={{ fill: getRepMaxColor(), r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls={true}
              />
            )}
            {showRepMaxVariants && repMaxGroups.length > 1 && <Legend />}
          </LineChart>
        </ResponsiveContainer>
  )

  if (!showCard) {
    return chartContent
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>PR Progress Over Time</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{filteredPRs.length} total entries</p>
      </CardHeader>
      <CardContent>
        {chartContent}
      </CardContent>
    </Card>
  )
}