import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface WeeklyBarChartProps {
  data: Array<{
    weekStart: string;
    created: number;
    completed: number;
    ma?: number | null;
  }>;
  height?: number;
}

/**
 * Bar chart of created (gray) vs completed (green) per week, with the 4-week
 * moving average of completed overlaid as a smooth line.
 */
export function WeeklyBarChart({ data, height = 280 }: WeeklyBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="weekStart"
          tickFormatter={(d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          tick={{ fontSize: 11 }}
        />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          labelFormatter={(d: string) => `Week of ${new Date(d).toLocaleDateString()}`}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="created" name="Created" fill="#94a3b8" radius={[2, 2, 0, 0]} />
        <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[2, 2, 0, 0]} />
        <Line
          type="monotone"
          dataKey="ma"
          name="4-wk MA"
          stroke="#0ea5e9"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

interface SimpleBarChartProps {
  data: Array<{ label: string; value: number; isOutlier?: boolean }>;
  height?: number;
}

/** Horizontal bar chart for per-member workload. */
export function MemberLoadChart({ data, height = 280 }: SimpleBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 30, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={120} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Bar dataKey="value" name="Open tasks" radius={[0, 2, 2, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.isOutlier ? '#ef4444' : '#0ea5e9'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

