import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';

interface SparklineProps {
  values: (number | null)[];
  height?: number;
  color?: string;
}

/**
 * Tiny inline trend line, no axes/legend. Used for per-status p75 trend in
 * the bottlenecks view. Null values are connected over (recharts default).
 */
export function Sparkline({ values, height = 32, color = '#0ea5e9' }: SparklineProps) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
