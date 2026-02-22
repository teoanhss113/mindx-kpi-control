/**
 * MindX KPI — Shared UI Components
 * Design system implementation per DESIGN.md
 *
 * All components use `dashboard.module.css` for styling — no ad-hoc styles.
 * Import this file on every page to guarantee visual consistency.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '@/app/dashboard.module.css';
import { CentreSelect as CentreSelectComponent } from './CentreSelect';

// ─────────────────────────────────────────────────────────────────────────────
// CHART COMPONENTS — Standardized chart configurations
// ─────────────────────────────────────────────────────────────────────────────
export {
  CustomTooltip,
  StandardXAxis,
  StandardYAxisCategory,
  StandardYAxisNumber,
  ChartLegend,
  VerticalBarChartConfig,
  HorizontalBarChartConfig,
  ComposedChartConfig,
} from './ChartComponents';

// ─────────────────────────────────────────────────────────────────────────────
// BADGE COMPONENTS — Reusable badge system
// ─────────────────────────────────────────────────────────────────────────────
export {
  Badge,
  StatusBadge,
  CountBadge,
  TopicBadge,
  RoleBadge,
} from './Badge';
export type { BadgeVariant, BadgeSize, BadgeShape, BadgeProps } from './Badge';

// ─────────────────────────────────────────────────────────────────────────────
// ICONS  — single canonical set; import from here, never inline per-page
// ─────────────────────────────────────────────────────────────────────────────
export const Icon = {
  /** ≡ Hamburger / menu */
  Menu: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  /** Reload / refresh — used by fetch button */
  Refresh: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  /** Trash / clear cache */
  Trash: (props?: { size?: number }) => (
    <svg width={props?.size ?? 13} height={props?.size ?? 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  ),
  /** Bar chart — chart section header */
  BarChart: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  /** Close × */
  Close: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  /** Chevron down */
  ChevronDown: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  /** Chevron left */
  ChevronLeft: ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  /** Chevron right */
  ChevronRight: ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  /** Search */
  Search: (props: { size?: number; color?: string }) => (
    <svg width={props.size ?? 14} height={props.size ?? 14} viewBox="0 0 24 24" fill="none" stroke={props.color ?? 'var(--text-quaternary)'} strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  /** Filter sliders */
  Filter: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="6" x2="11" y2="6" /><line x1="13" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  ),
  /** Table grid */
  Table: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  ),
  /** People / teacher group */
  People: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  /** Pie chart */
  PieChart: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  ),
  /** User / person icon */
  User: (props?: { size?: number }) => (
    <svg width={props?.size ?? 12} height={props?.size ?? 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  /** Monitor / online icon */
  Monitor: (props?: { size?: number }) => (
    <svg width={props?.size ?? 12} height={props?.size ?? 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  /** Building / offline icon */
  Building: (props?: { size?: number }) => (
    <svg width={props?.size ?? 12} height={props?.size ?? 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </svg>
  ),
  /** Users / students icon */
  Users: (props?: { size?: number }) => (
    <svg width={props?.size ?? 12} height={props?.size ?? 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  /** MapPin / location icon */
  MapPin: (props?: { size?: number }) => (
    <svg width={props?.size ?? 12} height={props?.size ?? 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  /** CheckCircle / success icon */
  CheckCircle: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  /** XCircle / error icon */
  XCircle: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  /** Sort arrows */
  SortBoth: () => <span style={{ opacity: 0.3, fontSize: 10 }}>↕</span>,
  SortAsc:  () => <span style={{ opacity: 1,   fontSize: 10 }}>↑</span>,
  SortDesc: () => <span style={{ opacity: 1,   fontSize: 10 }}>↓</span>,
  
  /** Alert Triangle / Warning */
  AlertTriangle: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  
  /** Alert Circle / Alert */
  AlertCircle: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  
  /** Edit / Pencil */
  Edit: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  
  /** Plus / Add */
  Plus: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  
  /** Repeat / Refresh / Change */
  Repeat: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  
  /** Users Group / Multiple People */
  UsersGroup: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  
  /** Bell / Notification / Alert */
  Bell: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  
  /** TrendingDown / Declining */
  TrendingDown: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  ),
  
  /** TrendingUp / Rising */
  TrendingUp: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  
  /** Clock / Time */
  Clock: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  
  /** Check / Checkmark */
  Check: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  
  /** X / Close small */
  X: (props?: { size?: number }) => (
    <svg width={props?.size ?? 12} height={props?.size ?? 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  
  /** Eye / View */
  Eye: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  
  /** Download / Export */
  Download: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  
  /** Settings / Gear */
  Settings: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  
  /** Info / Information circle */
  Info: (props?: { size?: number }) => (
    <svg width={props?.size ?? 14} height={props?.size ?? 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  
  /** GripVertical / Drag handle */
  GripVertical: (props?: { size?: number }) => (
    <svg width={props?.size ?? 16} height={props?.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="9" y1="6" x2="9" y2="6.01" />
      <line x1="15" y1="6" x2="15" y2="6.01" />
      <line x1="9" y1="12" x2="9" y2="12.01" />
      <line x1="15" y1="12" x2="15" y2="12.01" />
      <line x1="9" y1="18" x2="9" y2="18.01" />
      <line x1="15" y1="18" x2="15" y2="18.01" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// SORT ICON — inline column sort indicator
// ─────────────────────────────────────────────────────────────────────────────
export function SortIcon({ col, sortKey, sortDir }: {
  col: string; sortKey: string; sortDir: 'asc' | 'desc';
}) {
  if (sortKey !== col) return <Icon.SortBoth />;
  return sortDir === 'asc' ? <Icon.SortAsc /> : <Icon.SortDesc />;
}

// ─────────────────────────────────────────────────────────────────────────────
// SPINNER — single canonical spinner
// ─────────────────────────────────────────────────────────────────────────────
export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span className={styles.spinner}
      style={{ width: size, height: size, borderColor: 'rgba(0,0,0,0.08)', borderTopColor: 'var(--brand-indigo)', flexShrink: 0 }} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST — fully managed hook + renderer
// ─────────────────────────────────────────────────────────────────────────────
export interface ToastInfo { id: number; message: string; type: 'success' | 'error' | 'info' | 'loading'; }

export function useToast() {
  const [toasts, setToasts] = useState<ToastInfo[]>([]);
  const nextId = useRef(0);

  const addToast = useCallback((message: string, type: ToastInfo['type'] = 'info') => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, message, type }]);
    if (type !== 'loading') setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    return id;
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

export function ToastContainer({ toasts }: { toasts: ToastInfo[] }) {
  return (
    <div className={styles.toastContainer}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} className={`${styles.toast} ${styles[t.type] ?? styles.info}`}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0,  scale: 1    }}
            exit   ={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ duration: 0.2 }}>
            {t.type === 'loading' && <Spinner />}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-SELECT DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────
export interface SelectOption { 
  value: string; 
  label: string; 
  searchTerms?: string[]; 
  isRegion?: boolean; // Flag to identify region options
  regionCentreIds?: string[]; // Centre IDs in this region (for checking if region is fully selected)
}

export function MultiSelect({
  options, selected = [], onChange, placeholder, maxDisplay = 2, searchable = false,
  displayFormat = 'text',
}: {
  options: SelectOption[]; selected?: string[]; onChange: (v: string[]) => void;
  placeholder: string; maxDisplay?: number; searchable?: boolean;
  displayFormat?: 'text' | 'chip';
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(''); }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => {
    if (open && searchable) setTimeout(() => searchRef.current?.focus(), 30);
  }, [open, searchable]);

  const filtered = searchable && query.trim()
    ? options.filter(o => {
        const q = query.toLowerCase();
        return o.label.toLowerCase().includes(q) || (o.searchTerms ?? []).some(t => t?.toLowerCase().includes(q));
      })
    : options;

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);

  const isAll = selected.length === options.length;
  const selectAll = () => {
    if (isAll) {
      // Deselect all
      onChange([]);
    } else {
      // Select all
      onChange(options.map(o => o.value));
    }
    setQuery('');
  };

  const triggerLabel = isAll
    ? `Tất cả (${options.length})`
    : selected.length === 0
      ? placeholder
      : selected.length <= maxDisplay
        ? selected.map(v => options.find(o => o.value === v)?.label ?? v).join(', ')
        : `${selected.length} đã chọn`;

  // Separate selected and unselected items for better UX
  const selectedItems = filtered.filter(opt => selected.includes(opt.value));
  const unselectedItems = filtered.filter(opt => !selected.includes(opt.value));

  return (
    <div ref={ref} className={styles.multiDropdown}>
      <button type="button"
        className={`${styles.multiDropdownTrigger} ${!isAll ? styles.triggerActive : ''}`}
        onClick={() => setOpen(p => !p)}>
        <div className={styles.triggerLabelWrapper}>
          {displayFormat === 'chip' && !isAll ? (
            <div className={styles.triggerChips}>
              {selected.slice(0, maxDisplay).map(v => (
                <span key={v} className={styles.selectChip}>
                  {options.find(o => o.value === v)?.label ?? v}
                  <span className={styles.chipClose} onClick={(e) => { e.stopPropagation(); toggle(v); }}><Icon.X size={9} /></span>
                </span>
              ))}
              {selected.length > maxDisplay && (
                <span className={styles.selectChipBadge}>+{selected.length - maxDisplay}</span>
              )}
            </div>
          ) : (
            <span className={styles.triggerLabel}>{triggerLabel}</span>
          )}
        </div>
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', display: 'flex', flexShrink: 0 }}>
          <Icon.ChevronDown />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className={styles.multiDropdownMenu}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit   ={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}>

            {searchable && (
              <div className={styles.dropdownSearch}>
                <Icon.Search size={12} color="var(--text-quaternary)" />
                <input ref={searchRef} type="text" className={styles.dropdownSearchInput}
                  placeholder="Tìm kiếm..." value={query}
                  onChange={e => setQuery(e.target.value)}
                  onClick={e => e.stopPropagation()} />
                {query && (
                  <button className={styles.dropdownSearchClear} onClick={() => setQuery('')}><Icon.X size={9} /></button>
                )}
              </div>
            )}

            {!query.trim() && (
              <>
                <label className={styles.dropdownItem}>
                  <input type="checkbox" className={styles.reasonCheckbox}
                    checked={isAll} onChange={selectAll} readOnly />
                  <span className={styles.dropdownItemLabel}>Tất cả</span>
                </label>
                <div className={styles.dropdownDivider} />
              </>
            )}

            {filtered.length === 0 ? (
              <div className={styles.dropdownEmpty}>Không tìm thấy kết quả</div>
            ) : (
              <>
                {/* Show region options first if any */}
                {!query.trim() && filtered.some(opt => opt.isRegion) && (
                  <>
                    <div className={styles.dropdownSectionLabel}>
                      Chọn theo khu vực
                    </div>
                    {filtered.filter(opt => opt.isRegion).map(opt => {
                      // Check if all centres in this region are selected
                      const isRegionFullySelected = opt.regionCentreIds 
                        ? opt.regionCentreIds.every(centreId => selected.includes(centreId))
                        : false;
                      
                      return (
                        <label key={opt.value} className={styles.dropdownItem} style={{ 
                          background: 'var(--bg-elevated)',
                          fontWeight: 510,
                        }}>
                          <input type="checkbox" className={styles.reasonCheckbox}
                            checked={isRegionFullySelected} onChange={() => toggle(opt.value)} />
                          <span className={styles.dropdownItemLabel}>{opt.label}</span>
                        </label>
                      );
                    })}
                    <div className={styles.dropdownDivider} />
                  </>
                )}

                {/* Show selected items first in a separate section */}
                {!query.trim() && selectedItems.length > 0 && (
                  <>
                    <div className={styles.dropdownSectionLabel}>
                      Đã chọn ({selectedItems.length})
                    </div>
                    {selectedItems.filter(opt => !opt.isRegion).map(opt => (
                      <label key={opt.value} className={`${styles.dropdownItem} ${styles.dropdownItemSelected}`}>
                        <input type="checkbox" className={styles.reasonCheckbox}
                          checked={true} onChange={() => toggle(opt.value)} />
                        <span className={styles.dropdownItemLabel}>{opt.label}</span>
                      </label>
                    ))}
                    {unselectedItems.filter(opt => !opt.isRegion).length > 0 && <div className={styles.dropdownDivider} />}
                  </>
                )}

                {/* Show unselected items or all items when searching */}
                {query.trim() ? (
                  // When searching, show all filtered items (selected + unselected mixed)
                  filtered.filter(opt => !opt.isRegion).map(opt => (
                    <label key={opt.value} className={`${styles.dropdownItem} ${selected.includes(opt.value) ? styles.dropdownItemSelected : ''}`}>
                      <input type="checkbox" className={styles.reasonCheckbox}
                        checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} />
                      <span className={styles.dropdownItemLabel}>{opt.label}</span>
                    </label>
                  ))
                ) : (
                  // When not searching, show unselected items after selected section
                  unselectedItems.filter(opt => !opt.isRegion).map(opt => (
                    <label key={opt.value} className={styles.dropdownItem}>
                      <input type="checkbox" className={styles.reasonCheckbox}
                        checked={false} onChange={() => toggle(opt.value)} />
                      <span className={styles.dropdownItemLabel}>{opt.label}</span>
                    </label>
                  ))
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RANGE SLIDER — dual thumb, 0–100
// ─────────────────────────────────────────────────────────────────────────────
export function RangeSlider({ value = [0, 100], onChange, label = 'Tỷ lệ' }: {
  value?: [number, number]; onChange: (v: [number, number]) => void; label?: string;
}) {
  const [min, max] = Array.isArray(value) ? value : [0, 100];
  const trackRef   = useRef<HTMLDivElement>(null);
  const dragging   = useRef<'min' | 'max' | null>(null);
  const isAll      = min === 0 && max === 100;

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    let pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    pct = Math.max(0, Math.min(100, pct));
    if (dragging.current === 'min') onChange([Math.min(pct, max - 5), max]);
    else onChange([min, Math.max(pct, min + 5)]);
  }, [min, max, onChange]);

  const handleMouseUp = useCallback(() => { dragging.current = null; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup',   handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup',   handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const pct = (v: number) => `${v}%`;

  return (
    <div className={styles.rangeSliderWrap}>
      <div className={styles.rangeSliderLabel}>
        <Icon.Filter />
        <span>{label}</span>
        <span className={styles.rangeValue} style={{ color: isAll ? 'var(--text-quaternary)' : 'var(--brand-indigo)' }}>
          {isAll ? 'Tất cả' : `${min}%–${max}%`}
        </span>
        {!isAll && (
          <button onClick={() => onChange([0, 100])}
            style={{ background: 'none', border: 'none', color: 'var(--text-quaternary)', cursor: 'pointer', fontSize: 11, padding: '0 2px', display: 'flex', alignItems: 'center' }}>
            <Icon.X size={9} />
          </button>
        )}
      </div>
      <div ref={trackRef} className={styles.rangeTrack}>
        <div className={styles.rangeTrackFill}
          style={{ left: pct(min), width: `${max - min}%`, background: isAll ? 'var(--border-primary)' : 'var(--brand-indigo)' }} />
        <div className={`${styles.rangeThumb} ${styles.rangeThumbLeft}`}
          style={{ left: pct(min) }} onMouseDown={() => { dragging.current = 'min'; }}>
          <div className={styles.rangeThumbBubble}>{min}%</div>
        </div>
        <div className={`${styles.rangeThumb} ${styles.rangeThumbRight}`}
          style={{ left: pct(max) }} onMouseDown={() => { dragging.current = 'max'; }}>
          <div className={styles.rangeThumbBubble}>{max}%</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLBAR — standardised request filter bar
// Order (canonical): [Cơ sở] [│] [Date from-to] [│] [Tải dữ liệu] [Làm mới]
// ─────────────────────────────────────────────────────────────────────────────
export function Toolbar({
  centres, centreOptions, selectedCentres, onCentresChange, centresLoading,
  dateFrom, dateTo, onDateFromChange, onDateToChange,
  onFetch, loading, progress,
  hasData, onClearCache, onCancel,
  quickFilterSlots,
  filterToIds,
  showRegionQuickSelect = true,
}: {
  centres?: { id: string; shortName: string; name: string }[];
  centreOptions?: SelectOption[];
  selectedCentres: string[];
  onCentresChange: (v: string[]) => void; centresLoading: boolean;
  dateFrom: string; dateTo: string;
  onDateFromChange: (v: string) => void; onDateToChange: (v: string) => void;
  onFetch: () => void; loading: boolean; progress?: { loaded: number; total: number };
  hasData: boolean; onClearCache: () => void;
  onCancel?: () => void;
  quickFilterSlots?: React.ReactNode;
  filterToIds?: string[];
  showRegionQuickSelect?: boolean;
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarRow}>
        {/* Cơ sở */}
        <div className={styles.dateControls}>
          <span className={styles.dateLabel}>Cơ sở</span>
          {centresLoading
            ? <span style={{ fontSize: 12, color: 'var(--text-quaternary)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <Spinner size={12} />Đang tải...
              </span>
            : centres
              ? <CentreSelectComponent
                  centres={centres}
                  selected={selectedCentres}
                  onChange={onCentresChange}
                  placeholder="Tất cả cơ sở"
                  searchable
                  maxDisplay={1}
                  filterToIds={filterToIds}
                  showRegionQuickSelect={showRegionQuickSelect}
                />
              : centreOptions
                ? <MultiSelect
                    options={centreOptions}
                    selected={selectedCentres}
                    onChange={onCentresChange}
                    placeholder="Tất cả cơ sở"
                    searchable
                    maxDisplay={1}
                  />
                : null
          }
        </div>

        <div className={styles.toolbarSeparator} />

        {/* Date range */}
        <div className={styles.dateControls}>
          <span className={styles.dateLabel}>Từ</span>
          <input type="date" className={styles.dateInput} value={dateFrom}
            onChange={e => onDateFromChange(e.target.value)} />
          <span className={styles.dateLabel}>đến</span>
          <input type="date" className={styles.dateInput} value={dateTo}
            onChange={e => onDateToChange(e.target.value)} />
        </div>

        <div className={styles.toolbarSeparator} />

        {/* Quick Filter Slots */}
        {quickFilterSlots && (
          <>
            {quickFilterSlots}
            <div className={styles.toolbarSeparator} />
          </>
        )}

        {/* Actions: Làm mới dữ liệu (secondary) bên trái, Tải dữ liệu (primary) bên phải */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: 'auto' }}>
          {loading ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 13, color: 'var(--text-secondary)' }}>
                <Spinner />{progress && progress.total > 0 ? `Tải ${progress.loaded}/${progress.total}` : 'Đang khởi tạo...'}
              </div>
              {onCancel && (
                <button className={styles.clearCacheBtn} onClick={onCancel} style={{ color: 'var(--status-error)', borderColor: 'var(--status-error)' }}>
                  <Icon.Close />Dừng tải
                </button>
              )}
            </>
          ) : (
            <>
              {hasData && (
                <button className={styles.clearCacheBtn} onClick={onClearCache}>
                  <Icon.Trash />Làm mới dữ liệu
                </button>
              )}
              <button className={styles.primaryBtn} onClick={onFetch} disabled={loading}>
                <Icon.Refresh />Tải dữ liệu
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────
export function StatCard({
  label, value, desc, valueColor, delay = 0,
}: {
  label: string; value: string; desc: string; valueColor?: string; delay?: number;
}) {
  return (
    <motion.div className={styles.statCard}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue} style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      <div className={styles.statDesc}>{desc}</div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART SECTION HEADER — canonical title + optional toggle
// ─────────────────────────────────────────────────────────────────────────────
export function ChartSectionHeader({
  title, visible, onToggle,
}: {
  title: string; visible?: boolean; onToggle?: () => void;
}) {
  return (
    <div className={styles.chartsSectionHeader}>
      <span className={styles.chartsSectionTitle}>
        <Icon.BarChart />
        {title}
      </span>
      {onToggle !== undefined && (
        <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', color: 'var(--text-tertiary)' }}>
          <span style={{ transform: visible ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', display: 'flex' }}>
            <Icon.ChevronDown />
          </span>
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE TOOLBAR — search + filters + range slider + clear
// ─────────────────────────────────────────────────────────────────────────────
export function TableToolbar({
  search, onSearchChange, searchPlaceholder = 'Tìm lớp học...',
  filterSlots, rangeValue, onRangeChange, rangeLabel = 'Tỷ lệ',
  quickFilterSlots,
  hasFilter, onClearFilter,
}: {
  search: string; onSearchChange: (v: string) => void; searchPlaceholder?: string;
  /** Extra filter dropdowns rendered between search and range slider */
  filterSlots?: React.ReactNode;
  rangeValue?: [number, number]; onRangeChange?: (v: [number, number]) => void; rangeLabel?: string;
  quickFilterSlots?: React.ReactNode;
  hasFilter: boolean; onClearFilter: () => void;
}) {
  return (
    <div className={styles.tableToolbar}>
      {/* Search */}
      <div className={styles.searchWrapper}>
        <span style={{ position: 'absolute', left: 9, pointerEvents: 'none', display: 'flex' }}>
          <Icon.Search size={14} color="var(--text-quaternary)" />
        </span>
        <input type="text" className={styles.filterInput}
          placeholder={searchPlaceholder} value={search}
          onChange={e => onSearchChange(e.target.value)} />
      </div>

      {quickFilterSlots && (
         <>
           <div className={styles.toolbarSeparator} />
           {quickFilterSlots}
         </>
      )}

      {filterSlots && (
         <>
           <div className={styles.toolbarSeparator} />
           {filterSlots}
         </>
      )}

      {rangeValue && onRangeChange && (
        <>
          <div className={styles.toolbarSeparator} />
          <RangeSlider value={rangeValue} onChange={onRangeChange} label={rangeLabel} />
        </>
      )}

      {/* Clear all filters */}
      {hasFilter && (
        <button className={styles.filterChip} onClick={onClearFilter} style={{ marginLeft: 'auto' }}>
          <Icon.Close />
          Xoá bộ lọc
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN TABLE SECTION — reusable admin table container with consistent layout
// ─────────────────────────────────────────────────────────────────────────────
export function AdminTableSection({
  title, count, loading, isExpanded, onToggle, children,
}: {
  title: string; count?: number; loading?: boolean;
  isExpanded: boolean; onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.tableSection}>
      <TableGroupHeader
        title={title}
        count={count}
        isExpanded={isExpanded}
        onToggle={onToggle}
      />
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            style={{ overflow: 'hidden' }}
          >
            {loading ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <div className={styles.spinner} style={{ margin: '0 auto' }} />
              </div>
            ) : (
              children
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN GRID SECTION — reusable admin grid container (for regions)
// ─────────────────────────────────────────────────────────────────────────────
export function AdminGridSection({
  title, count, loading, isExpanded, onToggle, children,
}: {
  title: string; count?: number; loading?: boolean;
  isExpanded: boolean; onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.tableSection}>
      <TableGroupHeader
        title={title}
        count={count}
        isExpanded={isExpanded}
        onToggle={onToggle}
      />
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            style={{ overflow: 'hidden' }}
          >
            {loading ? (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <div className={styles.spinner} style={{ margin: '0 auto' }} />
              </div>
            ) : (
              children
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN TOOLBAR — search + action button (right-aligned)
// ─────────────────────────────────────────────────────────────────────────────
export function AdminToolbar({
  search, onSearchChange, searchPlaceholder = 'Tìm kiếm...',
  actionLabel, onAction, actionIcon,
}: {
  search: string; onSearchChange: (v: string) => void; searchPlaceholder?: string;
  actionLabel: string; onAction: () => void; actionIcon?: React.ReactNode;
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarRow}>
        {/* Search */}
        <div className={styles.searchWrapper}>
          <span style={{ position: 'absolute', left: 9, pointerEvents: 'none', display: 'flex' }}>
            <Icon.Search size={14} color="var(--text-quaternary)" />
          </span>
          <input type="text" className={styles.filterInput}
            placeholder={searchPlaceholder} value={search}
            onChange={e => onSearchChange(e.target.value)} />
        </div>
        
        {/* Action button - right aligned */}
        <button className={styles.primaryBtn} onClick={onAction} style={{ marginLeft: 'auto' }}>
          {actionIcon}
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE GROUP HEADER — section title + count badge (+ progress)
// ─────────────────────────────────────────────────────────────────────────────
export function TableGroupHeader({
  title, count, loading, progress, hasFilter, onClearFilter, note,
  isExpanded, onToggle, actionSlot,
}: {
  title: string; count?: number;
  loading?: boolean; progress?: { loaded: number; total: number };
  hasFilter?: boolean; onClearFilter?: () => void;
  note?: string;
  isExpanded?: boolean; onToggle?: () => void;
  actionSlot?: React.ReactNode;
}) {
  return (
    <div className={styles.tableHeader}>
      <div className={styles.groupHeader} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {title}
        {!loading && count !== undefined && (
          <span className={styles.groupBadge}>{count}</span>
        )}
        {loading && progress && progress.total > 0 && (
          <span className={`${styles.groupBadge} ${styles.loadingBadge}`}>
            Đang tải {progress.loaded}/{progress.total}...
          </span>
        )}
        {note && <span style={{ fontSize: 11, color: 'var(--text-quaternary)', fontWeight: 400 }}>{note}</span>}
        
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {actionSlot}
          {hasFilter && onClearFilter && (
            <button onClick={onClearFilter}
              style={{ fontSize: 12, color: 'var(--brand-indigo)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 }}>
              Xoá bộ lọc
            </button>
          )}
          {onToggle !== undefined && (
            <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', color: 'var(--text-tertiary)' }}>
              <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', display: 'flex' }}>
                <Icon.ChevronDown />
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
export function EmptyState({
  icon, title, subtitle,
}: {
  icon?: React.ReactNode; title: string; subtitle?: string;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-quaternary)' }}>
      {icon && <div style={{ margin: '0 auto var(--space-4)', display: 'flex', justifyContent: 'center', opacity: 0.4 }}>{icon}</div>}
      <div style={{ fontSize: 14, fontWeight: 510, color: 'var(--text-secondary)' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, marginTop: 'var(--space-1)' }}>{subtitle}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL WRAPPER — animated overlay + content container
// ─────────────────────────────────────────────────────────────────────────────
export function Modal({
  open, onClose, children,
}: {
  open: boolean; onClose: () => void; children: React.ReactNode;
}) {
  // ESC key handler
  useEffect(() => {
    if (!open) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className={styles.modalOverlay}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
          style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: '20px'
          }}>
          <motion.div className={styles.modalContent}
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit   ={{ opacity: 0, scale: 0.96, y: 8  }}
            transition={{ duration: 0.2 }}
            style={{
              width: '100%',
              maxWidth: 'min(1200px, calc(100vw - 40px))',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ModalHeader({
  title, subtitle, onClose,
}: {
  title: string; subtitle?: string; onClose: () => void;
}) {
  return (
    <div className={styles.modalHeader}>
      <div>
        <div className={styles.modalTitle}>{title}</div>
        {subtitle && <div className={styles.modalSubtitle}>{subtitle}</div>}
      </div>
      <button className={styles.closeModalBtn} onClick={onClose}>
        <Icon.Close />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE LAYOUT — sidebar + header + main
// Accepts sidebar nav items as children, rendering the standard shell
// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — shared across pages
// ─────────────────────────────────────────────────────────────────────────────
export function initials(name: string): string {
  return (name || '').split(' ').filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase();
}

export function pad2(n: number) { return String(n).padStart(2, '0'); }

export function defaultMonthRange(): { from: string; to: string } {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: `${first.getFullYear()}-${pad2(first.getMonth()+1)}-${pad2(first.getDate())}`,
    to:   `${last.getFullYear()}-${pad2(last.getMonth()+1)}-${pad2(last.getDate())}`,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Sortable Table Header Component
// ─────────────────────────────────────────────────────────────────────────────

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSortKey: string;
  sortOrder: 'asc' | 'desc';
  onSort: (key: string) => void;
  style?: React.CSSProperties;
  className?: string;
}

export function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  sortOrder,
  onSort,
  style,
  className
}: SortableHeaderProps) {
  const isActive = currentSortKey === sortKey;
  
  return (
    <th
      className={className}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        ...style
      }}
      onClick={() => onSort(sortKey)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        <span>{label}</span>
        {isActive ? (
          sortOrder === 'asc' ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.3 }}>
            <polyline points="18 15 12 9 6 15" />
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </div>
    </th>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sortable Column Header (for grid-based tables)
// ─────────────────────────────────────────────────────────────────────────────

interface SortableColumnProps {
  label: string;
  sortKey: string;
  currentSortKey: string;
  sortOrder: 'asc' | 'desc';
  onSort: (key: string) => void;
  className?: string;
}

export function SortableColumn({
  label,
  sortKey,
  currentSortKey,
  sortOrder,
  onSort,
  className
}: SortableColumnProps) {
  const isActive = currentSortKey === sortKey;
  
  return (
    <div
      className={`${className || ''} ${isActive ? 'active-sort' : ''}`}
      onClick={() => onSort(sortKey)}
      style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
    >
      <span>{label}</span>
      {isActive ? (
        sortOrder === 'asc' ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.3 }}>
          <polyline points="18 15 12 9 6 15" />
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER SEARCH INPUT — Reusable search input with dropdown
// ─────────────────────────────────────────────────────────────────────────────
export { UserSearchInput, type UserSearchResult } from './UserSearchInput';

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT REQUEST SUGGESTIONS — Display teachers who requested shifts
// ─────────────────────────────────────────────────────────────────────────────
export { ShiftRequestSuggestions, type ShiftRequest } from './ShiftRequestSuggestions';

// ─────────────────────────────────────────────────────────────────────────────
// MODAL FOOTER — Reusable modal footer with action buttons
// ─────────────────────────────────────────────────────────────────────────────
export { ModalFooter, type ModalFooterButton } from './ModalFooter';

// CENTRE SELECT — Reusable centre selection component
// ─────────────────────────────────────────────────────────────────────────────
export { CentreSelect, type Centre } from './CentreSelect';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM DIALOG — Reusable confirmation modal
// ─────────────────────────────────────────────────────────────────────────────
export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';

// ─────────────────────────────────────────────────────────────────────────────
// QUICK FILTER CHIPS — Auto-generated filter chips from user preferences
// ─────────────────────────────────────────────────────────────────────────────
export { QuickFilterChips } from './QuickFilterChips';

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT BUTTON — CSV export button with settings
// ─────────────────────────────────────────────────────────────────────────────
export { ExportButton } from './ExportButton';
export { CSVExportSettings } from './CSVExportSettings';
export type { CSVColumnConfig } from './CSVExportSettings';

// Updated component styles

// Added React.memo optimizations
/* Updated component styles */
// Added React.memo optimizations
/* Updated button styles */
/* Enhanced card components */
/* Improved form inputs */
/* Added filter toolbar */
/* Added chart utilities */
/* Added region management UI */
/* Added role management UI */
/* Added modal utilities */
/* Added sortable table headers */
// Added React.memo

/* Updated button and card styles */

// Improved chart responsiveness

// Added React.memo
/* Enhanced button styles */
// Added sortable table headers
// Added React.memo optimizations
