/**
 * Chart Components - Standardized chart configurations with Linear Design System
 * 
 * Linear Design Principles (per DESIGN.md):
 * - Linear Indigo (#5e6ad2) as primary brand accent
 * - Minimal grid lines with subtle opacity (rgba(0,0,0,0.06))
 * - Dark tooltips with white text (#1f2937 background)
 * - Inter Variable with 'cv01', 'ss03' for all chart labels
 * - Weight 510 as signature emphasis
 * - Subtle shadows on elevated chart containers
 */

import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
} from 'recharts';
import { KPI_COLORS } from '@/lib/kpiScoring';
import styles from '@/app/dashboard.module.css';

type ChartValue = string | number;
type KPIScore = keyof typeof KPI_COLORS;

interface TooltipPayloadItem {
  color?: string;
  name?: ChartValue;
  value?: ChartValue;
}

// ─── Custom Tooltip Component (Linear Dark Style) ─────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
}

export const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div style={{
      // Linear Design: Dark background with white text
      background: 'var(--text-primary)',
      color: 'var(--bg-surface)',
      borderRadius: 'var(--radius-comfortable)',
      padding: 'var(--space-2) var(--space-3)',
      fontSize: 12,
      fontFamily: 'Inter, SF Pro Display, -apple-system, system-ui, sans-serif',
      fontFeatureSettings: '"cv01", "ss03"',  // Linear's OpenType features
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      border: 'none',
      lineHeight: 1.6,
    }}>
      {/* Label - tên category (cơ sở, khối học, etc) */}
      {label && (
        <div style={{
          color: 'var(--bg-surface)',
          fontWeight: 590,  // Linear strong emphasis
          marginBottom: 'var(--space-1)',
          letterSpacing: '-0.13px',
        }}>
          {label}
        </div>
      )}
      
      {/* Data values */}
      {payload.map((entry, index) => (
        <div key={index} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginTop: index > 0 ? 'var(--space-1)' : 0,
          color: 'var(--text-quaternary)',  // Muted
        }}>
          <span style={{
            width: 'var(--space-2)',
            height: 'var(--space-2)',
            background: entry.color,
            borderRadius: '50%',
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 12,
            letterSpacing: '-0.13px',
          }}>
            {entry.name}:
          </span>
          <span style={{
            color: 'var(--bg-surface)',
            fontWeight: 590,
            marginLeft: 'auto',
            letterSpacing: '-0.13px',
          }}>
            {typeof entry.value === 'number' 
              ? entry.value % 1 === 0 
                ? entry.value 
                : entry.value.toFixed(1)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Axis Label Component (Linear Typography) ─────────────────────────────────

interface AxisLabelProps {
  value: string;
  position?: 'insideLeft' | 'insideRight' | 'insideTop' | 'insideBottom' | 'center';
  angle?: number;
  offset?: number;
}

export const AxisLabel = ({ value, position = 'center', angle = 0, offset = 0 }: AxisLabelProps) => ({
  value,
  angle,
  position,
  offset,
  style: {
    fontSize: 11,
    fill: 'var(--text-quaternary)',  // var(--text-quaternary) - Linear tertiary text
    fontWeight: 510,  // Linear signature weight
    fontFamily: 'Inter, SF Pro Display, -apple-system, system-ui, sans-serif',
    letterSpacing: '-0.13px',  // Linear caption tracking
    textTransform: 'none' as const,
  },
});

// ─── Standard XAxis (Horizontal Charts - Linear Style) ───────────────────────

interface StandardXAxisProps {
  label?: string;
  type?: 'number' | 'category';
  domain?: [number, number];
  ticks?: number[];
  tickFormatter?: (value: ChartValue) => string;
}

export const StandardXAxis = ({ 
  label, 
  type = 'number', 
  domain, 
  ticks,
  tickFormatter 
}: StandardXAxisProps) => (
  <RechartsXAxis
    type={type}
    domain={domain}
    ticks={ticks}
    tickFormatter={tickFormatter}
    tick={{ 
      fontSize: 11, 
      fill: 'var(--text-quaternary)',  // Linear tertiary text
      fontFamily: 'Inter, SF Pro Display, -apple-system, system-ui, sans-serif',
      fontWeight: 510,  // Linear signature weight
    }}
    axisLine={false}  // Linear: no axis lines
    tickLine={false}  // Linear: no tick marks
    label={label ? AxisLabel({ value: label, position: 'insideBottom', offset: -5 }) : undefined}
  />
);

// ─── Standard YAxis (Vertical Charts - Category - Linear Style) ──────────────

interface StandardYAxisCategoryProps {
  dataKey: string;
  width?: number;
  label?: string;
  interval?: number | 'preserveStart' | 'preserveEnd' | 'preserveStartEnd';
}

export const StandardYAxisCategory = ({ 
  dataKey, 
  width = 80,
  label,
  interval = 0  // Default: show all labels
}: StandardYAxisCategoryProps) => (
  <RechartsYAxis
    dataKey={dataKey}
    type="category"
    width={width}
    interval={interval}
    tick={{ 
      fontSize: 11, 
      fill: 'var(--text-secondary)',  // Linear secondary text (darker for categories)
      fontFamily: 'Inter, SF Pro Display, -apple-system, system-ui, sans-serif',
      fontWeight: 510,  // Linear signature weight
    }}
    axisLine={false}  // Linear: no axis lines
    tickLine={false}  // Linear: no tick marks
    label={label ? AxisLabel({ value: label, angle: -90, position: 'insideLeft' }) : undefined}
  />
);

// ─── Standard YAxis (Horizontal Charts - Number - Linear Style) ──────────────

interface StandardYAxisNumberProps {
  yAxisId?: string;
  orientation?: 'left' | 'right';
  label?: string;
  domain?: [number, number];
  tickFormatter?: (value: ChartValue) => string;
}

export const StandardYAxisNumber = ({ 
  yAxisId = 'left',
  orientation = 'left',
  label,
  domain,
  tickFormatter
}: StandardYAxisNumberProps) => (
  <RechartsYAxis
    yAxisId={yAxisId}
    orientation={orientation}
    type="number"
    domain={domain}
    tickFormatter={tickFormatter}
    tick={{ 
      fontSize: 11, 
      fill: 'var(--text-quaternary)',  // Linear tertiary text
      fontFamily: 'Inter, SF Pro Display, -apple-system, system-ui, sans-serif',
      fontWeight: 510,  // Linear signature weight
    }}
    axisLine={false}  // Linear: no axis lines
    tickLine={false}  // Linear: no tick marks
    label={label ? AxisLabel({ value: label, angle: -90, position: orientation === 'left' ? 'insideLeft' : 'insideRight' }) : undefined}
  />
);

// ─── Chart Legend Wrapper (Linear Style) ──────────────────────────────────────

interface ChartLegendItem {
  color: string;
  label: string;
}

export type ChartLegendItemConfig = ChartLegendItem;

export type KPIChartDatum = {
  name: string;
  value?: number;
  rate?: number;
  score?: KPIScore;
  [key: string]: string | number | KPIScore | undefined;
};

export const CHART_LAYOUT = {
  BAR_HEIGHT: 32,
  MIN_HEIGHT: 180,
  LEGEND_HEIGHT: 44,
  TITLE_HEIGHT: 28,
  GRID_STROKE: 'rgba(0,0,0,0.06)',
  CURSOR_FILL: 'rgba(0,0,0,0.03)',
  BAR_RADIUS: [0, 4, 4, 0] as [number, number, number, number],
  MAX_BAR_SIZE: 16,
} as const;

export function getChartHeight(itemCount: number, minHeight = CHART_LAYOUT.MIN_HEIGHT) {
  return Math.max(minHeight, itemCount * CHART_LAYOUT.BAR_HEIGHT);
}

export function getSharedChartLayout(itemCounts: number[], minHeight = CHART_LAYOUT.MIN_HEIGHT) {
  const chartHeight = Math.max(...itemCounts.map(count => getChartHeight(count, minHeight)), minHeight);
  return {
    chartHeight,
    cardHeight: chartHeight + CHART_LAYOUT.LEGEND_HEIGHT + CHART_LAYOUT.TITLE_HEIGHT,
  };
}

export function getPaddedPercentDomain(values: number[], fallbackMax = 10): [number, number] {
  const maxValue = Math.max(...values, 0);
  return [0, Math.min(100, Math.ceil(maxValue * 1.3 + 0.5) || fallbackMax)];
}

export function getKPILegendItems(items: { score: KPIScore; label: string }[]): ChartLegendItemConfig[] {
  return items.map(item => ({ color: KPI_COLORS[item.score], label: item.label }));
}

export function KPIChartLegend({ items }: { items: ChartLegendItemConfig[] }) {
  return (
    <div className={styles.chartLegend}>
      {items.map(item => (
        <div key={item.label} className={styles.legendItem}>
          <span className={styles.legendSwatch} style={{ background: item.color }} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

export function KPIChartCard({
  title,
  children,
  legendItems,
  height,
}: {
  title: string;
  children: ReactNode;
  legendItems?: ChartLegendItemConfig[];
  height?: number;
}) {
  return (
    <div className={styles.chartCard} style={{ height, display: 'flex', flexDirection: 'column' }}>
      <div className={styles.chartTitle}>{title}</div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      {legendItems && <KPIChartLegend items={legendItems} />}
    </div>
  );
}

export function KPIBarChart({
  data,
  dataKey = 'rate',
  scoreKey = 'score',
  xLabel = 'Tỷ lệ (%)',
  yLabel,
  domain = [0, 100],
  ticks,
  height,
  valueFormatter = value => `${Number(value).toFixed(1)}%`,
  tickFormatter = value => `${value}%`,
  getColor,
  showValueLabel = false,
}: {
  data: KPIChartDatum[];
  dataKey?: string;
  scoreKey?: string;
  xLabel?: string;
  yLabel: string;
  domain?: [number, number];
  ticks?: number[];
  height: number;
  valueFormatter?: (value: number) => string;
  tickFormatter?: (value: ChartValue) => string;
  getColor?: (datum: KPIChartDatum) => string;
  showValueLabel?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} {...VerticalBarChartConfig}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_LAYOUT.GRID_STROKE} />
        <StandardXAxis label={xLabel} domain={domain} ticks={ticks} tickFormatter={tickFormatter} />
        <StandardYAxisCategory dataKey="name" label={yLabel} />
        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: CHART_LAYOUT.CURSOR_FILL }} />
        <Bar
          dataKey={dataKey}
          radius={CHART_LAYOUT.BAR_RADIUS}
          maxBarSize={CHART_LAYOUT.MAX_BAR_SIZE}
          label={showValueLabel ? {
            position: 'right',
            fontSize: 10,
            fill: 'var(--text-quaternary)',
            formatter: (value) => (typeof value === 'number' && value > 0 ? valueFormatter(value) : ''),
          } : undefined}
        >
          {data.map((datum, index) => (
            <Cell
              key={`${datum.name}-${index}`}
              fill={getColor?.(datum) ?? (datum[scoreKey] ? KPI_COLORS[datum[scoreKey] as KPIScore] : 'var(--brand-indigo)')}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface ChartLegendProps {
  items: ChartLegendItem[];
}

export const ChartLegend = ({ items }: ChartLegendProps) => (
  <div style={{
    display: 'flex',
    gap: 'var(--space-3)',
    flexWrap: 'wrap',
    padding: 'var(--space-3) var(--space-4)',
    background: 'rgba(0,0,0,0.01)',  // Subtle elevated background
    borderTop: '1px solid rgba(0,0,0,0.08)',  // Linear border
    borderRadius: '0 0 var(--radius-card) var(--radius-card)',
  }}>
    {items.map((item, idx) => (
      <div key={idx} style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 'var(--space-2)',
      }}>
        <span style={{
          width: 'var(--space-2)',
          height: 'var(--space-2)',
          background: item.color,
          borderRadius: '50%',  // Circular swatch
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',  // Linear tertiary text
          fontWeight: 510,  // Linear signature weight
          fontFamily: 'Inter, SF Pro Display, -apple-system, system-ui, sans-serif',
          fontFeatureSettings: '"cv01", "ss03"',
          letterSpacing: '-0.13px',
        }}>
          {item.label}
        </span>
      </div>
    ))}
  </div>
);

// ─── Preset Chart Configurations ─────────────────────────────────────────────

/**
 * Vertical Bar Chart Configuration
 * For charts with categories on Y-axis and values on X-axis
 */
export const VerticalBarChartConfig = {
  layout: 'vertical' as const,
  margin: { top: 4, right: 20, left: 20, bottom: 20 }, // Increased left margin for Y-axis label
};

/**
 * Horizontal Bar Chart Configuration
 * For charts with categories on X-axis and values on Y-axis
 */
export const HorizontalBarChartConfig = {
  layout: 'horizontal' as const,
  margin: { top: 20, right: 20, left: 40, bottom: 20 },
};

/**
 * Composed Chart Configuration (Dual Axis)
 * For charts with both Bar and Line components
 */
export const ComposedChartConfig = {
  layout: 'vertical' as const,
  margin: { top: 4, right: 60, left: 20, bottom: 20 }, // Increased left margin for Y-axis label
};
