import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CfdPoint } from '../../types';

interface CfdChartProps {
  data: CfdPoint[];
  height?: number;
}

/**
 * Stacked-area Cumulative Flow Diagram. Each band's vertical thickness is the
 * count of tasks in that status on that day. Widening bands = bottlenecks
 * (tasks accumulating in a stage); narrowing = flow.
 */
export function CfdChart({ data, height = 320 }: CfdChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) =>
            new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          }
          tick={{ fontSize: 11 }}
          minTickGap={30}
        />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {/* Stack order (bottom up): DONE → IN_REVIEW → IN_PROGRESS → TODO */}
        <Area
          type="monotone"
          dataKey="done"
          name="Done"
          stackId="1"
          stroke="#22c55e"
          fill="#22c55e"
          fillOpacity={0.6}
        />
        <Area
          type="monotone"
          dataKey="inReview"
          name="In Review"
          stackId="1"
          stroke="#f59e0b"
          fill="#f59e0b"
          fillOpacity={0.6}
        />
        <Area
          type="monotone"
          dataKey="inProgress"
          name="In Progress"
          stackId="1"
          stroke="#0ea5e9"
          fill="#0ea5e9"
          fillOpacity={0.6}
        />
        <Area
          type="monotone"
          dataKey="todo"
          name="To Do"
          stackId="1"
          stroke="#94a3b8"
          fill="#94a3b8"
          fillOpacity={0.6}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
