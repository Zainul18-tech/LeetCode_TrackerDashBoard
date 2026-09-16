"use client"

import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell
} from "recharts"

// Each chart consumes a different data shape, so instead of one loose
// `any[]` prop, every chart gets its own narrow datum type. This keeps
// type-checking meaningful (e.g. DifficultyPieChart can't be passed bar
// data by mistake) while still being just as easy to call.

interface BarDatum {
  name: string
  solved: number
}

interface BarChartProps {
  data: BarDatum[]
  className?: string
}

interface LineDatum {
  name: string
  solved: number
  expected?: number
}

interface LineChartProps {
  data: LineDatum[]
  className?: string
}

interface PieDatum {
  name?: string
  value: number
  fill: string
}

interface PieChartProps {
  data: PieDatum[]
  className?: string
}

export function OverviewBarChart({ data }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => `${value}`}
        />
        <Tooltip 
          cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
        />
        <Bar dataKey="solved" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ProgressLineChart({ data }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
        <Line
          type="monotone"
          dataKey="solved"
          stroke="#3b82f6"
          strokeWidth={2}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="expected"
          stroke="#94a3b8"
          strokeWidth={2}
          strokeDasharray="5 5"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function DifficultyPieChart({ data }: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
        >
          {data.map((entry: PieDatum, index: number) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}