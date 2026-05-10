import React from 'react';
import styles from '@/app/dashboard.module.css';
import { COURSE_CATEGORY_COLORS, type Course } from '@/constants';

// Badge variant types based on existing CSS classes
export type BadgeVariant = 
  | 'default'     // Basic gray badge
  | 'passed'      // Green success badge
  | 'failed'      // Red error badge  
  | 'exempt'      // Neutral gray badge
  | 'demo'        // Orange demo badge
  | 'warning'     // Amber warning badge
  | 'info'        // Blue info badge
  | 'purple'      // Purple badge
  | 'custom';     // Custom colors

// Badge size variants
export type BadgeSize = 
  | 'sm'          // Small badge (10px font, tight padding)
  | 'md'          // Medium badge (11px font, standard padding) - default
  | 'lg';         // Large badge (12px font, generous padding)

// Badge shape variants  
export type BadgeShape = 
  | 'pill'        // Fully rounded (9999px radius)
  | 'rounded'     // Standard rounded (4px radius)
  | 'micro';      // Micro rounded (2px radius)

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  shape?: BadgeShape;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  title?: string;
  // Custom colors for 'custom' variant
  customColors?: {
    background: string;
    color: string;
    border: string;
  };
}

// Predefined color schemes following design system
const BADGE_COLORS = {
  default: {
    background: 'var(--bg-panel)',
    color: 'var(--text-tertiary)',
    border: 'var(--border-primary)'
  },
  passed: {
    background: 'rgba(5, 150, 105, 0.08)',
    color: 'var(--status-success)',
    border: 'rgba(5, 150, 105, 0.25)'
  },
  failed: {
    background: 'rgba(220, 38, 38, 0.08)',
    color: 'var(--status-error)',
    border: 'rgba(220, 38, 38, 0.25)'
  },
  exempt: {
    background: 'var(--bg-panel)',
    color: 'var(--text-quaternary)',
    border: 'var(--border-primary)'
  },
  demo: {
    background: 'rgba(251, 146, 60, 0.08)',
    color: 'var(--status-dark-orange)',
    border: 'rgba(251, 146, 60, 0.25)'
  },
  warning: {
    background: 'rgba(245, 158, 11, 0.08)',
    color: 'var(--status-warning)',
    border: 'rgba(245, 158, 11, 0.25)'
  },
  info: {
    background: 'rgba(94, 106, 210, 0.08)',
    color: 'var(--brand-indigo)',
    border: 'rgba(94, 106, 210, 0.25)'
  },
  purple: {
    background: 'rgba(139, 92, 246, 0.08)',
    color: 'var(--brand-indigo)',
    border: 'rgba(139, 92, 246, 0.25)'
  }
};

// Size configurations
const BADGE_SIZES = {
  sm: {
    fontSize: 10,
    padding: '1px 5px',
    fontWeight: 590
  },
  md: {
    fontSize: 11,
    padding: 'var(--space-1) var(--space-2)',
    fontWeight: 510
  },
  lg: {
    fontSize: 12,
    padding: 'var(--space-2) var(--space-3)',
    fontWeight: 510
  }
};

// Shape configurations
const BADGE_SHAPES = {
  pill: 'var(--radius-pill)',
  rounded: 'var(--radius-standard)',
  micro: 'var(--radius-micro)'
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  shape = 'rounded',
  className = '',
  style = {},
  onClick,
  title,
  customColors
}: BadgeProps) {
  // Get colors based on variant
  const colors = variant === 'custom' && customColors 
    ? customColors 
    : BADGE_COLORS[variant as keyof typeof BADGE_COLORS] || BADGE_COLORS.default;

  // Get size configuration
  const sizeConfig = BADGE_SIZES[size];
  
  // Get border radius
  const borderRadius = BADGE_SHAPES[shape];

  // Build CSS classes
  const cssClasses = [
    styles.statusPill, // Base badge class
    className
  ].filter(Boolean).join(' ');

  // Build inline styles
  const inlineStyles: React.CSSProperties = {
    backgroundColor: colors.background,
    color: colors.color,
    borderColor: colors.border,
    fontSize: sizeConfig.fontSize,
    fontWeight: sizeConfig.fontWeight,
    padding: sizeConfig.padding,
    borderRadius,
    display: 'inline-block',
    whiteSpace: 'nowrap',
    cursor: onClick ? 'pointer' : 'default',
    ...style
  };

  return (
    <span 
      className={cssClasses}
      style={inlineStyles}
      onClick={onClick}
      title={title}
    >
      {children}
    </span>
  );
}

// Convenience components for common badge types
export const StatusBadge = ({ status, ...props }: { status: 'passed' | 'failed' | 'exempt' } & Omit<BadgeProps, 'variant'>) => (
  <Badge variant={status} {...props} />
);

export const CountBadge = ({ count, ...props }: { count: number } & Omit<BadgeProps, 'variant' | 'size' | 'children'>) => (
  <Badge variant="failed" size="sm" {...props}>
    {count}
  </Badge>
);

export const TopicBadge = ({ topic, ...props }: { topic: string } & Omit<BadgeProps, 'variant' | 'customColors' | 'children'>) => {
  // Map topics to variants
  const topicVariants: Record<string, BadgeVariant> = {
    'Teacher': 'passed',
    'Content': 'info', 
    'Technical': 'purple',
    'Support': 'warning',
    'Others': 'default',
    'Khác': 'default'
  };

  const variant = topicVariants[topic] || 'default';

  return (
    <Badge variant={variant} {...props}>
      {topic}
    </Badge>
  );
};

export const RoleBadge = ({ role, ...props }: { role: string } & Omit<BadgeProps, 'variant' | 'customColors' | 'children'>) => {
  const variant = role === 'LEC' ? 'info' : role === 'SUPPLY' ? 'warning' : 'default';
  
  return (
    <Badge variant={variant} size="sm" {...props}>
      {role}
    </Badge>
  );
};

export const CourseCategoryBadge = ({
  category,
  ...props
}: {
  category: string | null | undefined;
} & Omit<BadgeProps, 'variant' | 'customColors' | 'children'>) => {
  const label = category || '—';
  const color = COURSE_CATEGORY_COLORS[label as Course] || 'var(--border-primary)';

  return (
    <Badge
      variant="default"
      shape="rounded"
      {...props}
      style={{
        borderLeft: `3px solid ${color}`,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        ...(props.style || {}),
      }}
    >
      {label}
    </Badge>
  );
};
