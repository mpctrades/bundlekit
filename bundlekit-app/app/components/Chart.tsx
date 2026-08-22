import { useId, useRef, useState } from "react";
import { motion } from "motion/react";

export interface ChartSeries {
  label: string;
  color: string;
  values: number[];
  /** Multiplies values only for plotting position (e.g. to share an axis
   *  with a much larger series) — tooltips/formatValue always see the real,
   *  unscaled value, never the plotted one. */
  scale?: number;
}

export interface ChartProps {
  /** X-axis labels, one per data point (e.g. ISO day strings). */
  labels: string[];
  series: ChartSeries[];
  height?: number;
  kind?: "line" | "bar";
  formatValue?: (value: number, seriesIndex: number) => string;
  formatLabel?: (label: string) => string;
}

const WIDTH = 640;
const PADDING = 24;

type Point = { x: number; y: number };

/** Catmull-Rom to cubic-Bezier — smooths the line without overshooting past
 *  the actual data points (unlike a naive spline), so it still reads as an
 *  honest chart, just less jagged than straight segments. */
function smoothPath(points: Point[]): string {
  if (points.length < 3) {
    return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  }
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return path;
}

export function Chart({
  labels,
  series,
  height = 160,
  kind = "line",
  formatValue = (value) => String(Math.round(value)),
  formatLabel = (label) => label,
}: ChartProps) {
  const gradientId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const maxValue = Math.max(1, ...series.flatMap((entry) => entry.values.map((value) => value * (entry.scale ?? 1))));
  const baseline = height - PADDING;
  const stepX = (WIDTH - PADDING * 2) / Math.max(1, labels.length - 1);

  const toXY = (values: number[], scale: number) =>
    values.map((value, index) => ({
      x: PADDING + index * stepX,
      y: baseline - ((value * scale) / maxValue) * (height - PADDING * 2),
    }));

  const seriesPoints = series.map((entry) => toXY(entry.values, entry.scale ?? 1));

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || labels.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    const index = Math.round(fraction * (labels.length - 1));
    setHoverIndex(Math.min(labels.length - 1, Math.max(0, index)));
  };

  const hoverX = hoverIndex !== null ? PADDING + hoverIndex * stepX : null;
  const tooltipLeftPct = hoverX !== null ? (hoverX / WIDTH) * 100 : null;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative" }}
      onMouseMove={handleMove}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <svg viewBox={`0 0 ${WIDTH} ${height}`} style={{ width: "100%", height, display: "block" }} role="img" aria-label="Chart">
        <defs>
          {series.map((entry) => (
            <linearGradient key={entry.label} id={`${gradientId}-${entry.label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={entry.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={entry.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        <line x1={PADDING} y1={baseline} x2={WIDTH - PADDING} y2={baseline} stroke="rgba(0,0,0,0.08)" />

        {kind === "bar"
          ? series.map((entry, seriesIndex) => {
              const points = seriesPoints[seriesIndex];
              const barWidth = Math.max(4, stepX * 0.5);
              return points.map((point, index) => (
                <motion.rect
                  key={`${entry.label}-${index}`}
                  x={point.x - barWidth / 2}
                  width={barWidth}
                  fill={entry.color}
                  rx={3}
                  opacity={hoverIndex === null || hoverIndex === index ? 1 : 0.45}
                  initial={{ y: baseline, height: 0 }}
                  animate={{ y: point.y, height: baseline - point.y }}
                  transition={{ duration: 0.5, delay: index * 0.02, ease: "easeOut" }}
                />
              ));
            })
          : series.map((entry, seriesIndex) => {
              const points = seriesPoints[seriesIndex];
              const linePath = smoothPath(points);
              const areaPath = `${linePath} L${points[points.length - 1].x},${baseline} L${points[0].x},${baseline} Z`;

              return (
                <g key={entry.label}>
                  {seriesIndex === 0 ? (
                    <motion.path
                      d={areaPath}
                      fill={`url(#${gradientId}-${entry.label})`}
                      stroke="none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.3 }}
                    />
                  ) : null}
                  <motion.path
                    d={linePath}
                    fill="none"
                    stroke={entry.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                  {hoverIndex !== null ? (
                    <circle cx={points[hoverIndex].x} cy={points[hoverIndex].y} r={4} fill={entry.color} stroke="#fff" strokeWidth={1.5} />
                  ) : null}
                </g>
              );
            })}

        {hoverX !== null ? (
          <line x1={hoverX} y1={PADDING * 0.2} x2={hoverX} y2={baseline} stroke="rgba(0,0,0,0.15)" strokeDasharray="3,3" />
        ) : null}
      </svg>

      {hoverIndex !== null && tooltipLeftPct !== null ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${tooltipLeftPct}%`,
            transform: tooltipLeftPct > 70 ? "translateX(-100%)" : tooltipLeftPct < 15 ? "translateX(0)" : "translateX(-50%)",
            background: "#1a1a1a",
            color: "#fff",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ opacity: 0.7, marginBottom: 2 }}>{formatLabel(labels[hoverIndex])}</div>
          {series.map((entry, seriesIndex) => (
            <div key={entry.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: entry.color, display: "inline-block" }} />
              <span>
                {entry.label}: {formatValue(entry.values[hoverIndex], seriesIndex)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
