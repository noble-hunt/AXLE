import { Card } from "@/components/swift/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface HeartRateChartProps {
  data: Array<{ time: string; value: number }>
}

export function HeartRateChart({ data }: HeartRateChartProps) {
  // Transform data for recharts
  const chartData = data.map(point => ({
    time: point.time,
    hr: point.value
  }))

  return (
    <Card className="p-6" data-testid="heart-rate-chart">
      <h3 className="text-body font-semibold text-foreground mb-4">Resting Heart Rate (24h)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
          <XAxis 
            dataKey="time" 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => {
              // Format time (HH:MM:SS to HH:MM)
              return value.split(':').slice(0, 2).join(':')
            }}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: '12px' }}
            domain={['dataMin - 5', 'dataMax + 5']}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '14px'
            }}
            formatter={(value: number) => [`${value} bpm`, 'Heart Rate']}
          />
          <Line 
            type="monotone" 
            dataKey="hr" 
            stroke="#06b6d4"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: "#06b6d4", stroke: "#ffffff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}
