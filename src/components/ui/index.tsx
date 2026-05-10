/**
 * MindX KPI — Shared UI Components
 * Design system implementation per DESIGN.md
 *
 * All components use `dashboard.module.css` for styling — no ad-hoc styles.
 * Import this file on every page to guarantee visual consistency.
 */

'use client'

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Menu as _Menu, RefreshCw, Trash2, BarChart2, X as _X,
  ChevronDown as _ChevronDown, ChevronLeft as _ChevronLeft, ChevronRight as _ChevronRight,
  Search as _Search, Filter as _Filter, Table2,
  Users as _Users, PieChart as _PieChart, User as _User,
  Monitor as _Monitor, Building2, MapPin as _MapPin,
  CheckCircle as _CheckCircle, XCircle as _XCircle,
  ArrowUpDown, ArrowUp, ArrowDown,
  AlertTriangle as _AlertTriangle, AlertCircle as _AlertCircle,
  Pencil, Plus as _Plus, Repeat2, UsersRound,
  Bell as _Bell, BellOff as _BellOff,
  TrendingDown as _TrendingDown, TrendingUp as _TrendingUp,
  Clock as _Clock, Check as _Check, Eye as _Eye,
  Download as _Download, Settings as _Settings, Info as _Info,
  GripVertical as _GripVertical,
  FileText as _FileText, Calendar as _Calendar, CalendarDays as _CalendarDays,
  ClipboardCheck as _ClipboardCheck, Target as _Target, BookOpen as _BookOpen,
  Copy as _Copy
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from '@/app/dashboard.module.css'
import { CentreSelect as CentreSelectComponent } from './CentreSelect'
import { FilterChip } from './FilterChip'

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
} from './ChartComponents'

// ─────────────────────────────────────────────────────────────────────────────
// BADGE COMPONENTS — Reusable badge system
// ─────────────────────────────────────────────────────────────────────────────
export { Badge, StatusBadge, CountBadge, TopicBadge, RoleBadge, CourseCategoryBadge, CentreBadge } from './Badge'
export type { BadgeVariant, BadgeSize, BadgeShape, BadgeProps } from './Badge'
export {
  ATTENDANCE_STATUS_STYLES,
  AttendanceSessionCell,
  AttendanceStatusBadge,
  getAttendanceStatusKind,
  getAttendanceStatusMeta,
  isAttendanceStatus,
  normalizeAttendanceStatus,
} from './AttendanceStatus'
export type { AttendanceStatusKind, AttendanceStatusMeta } from './AttendanceStatus'
export {
  COMMENT_STATUS_COUNT_LABELS,
  COMMENT_STATUS_GROUP_LABELS,
  COMMENT_STATUS_LABELS,
  CommentStatusBadge,
  getCommentStatusVariant,
} from './CommentStatus'
export type { CommentQualityStatus } from './CommentStatus'
export {
  ACTIVE_STATUS_LABELS,
  ACTIVE_STATUS_OPTIONS,
  ActiveStatusBadge,
  ATTENDANCE_ALERT_LABELS,
  COMPLETION_STATUS_LABELS,
  AttendanceAlertBadge,
  BATCH_STATUS_LABELS,
  BatchStatusBadge,
  CompletionStatusBadge,
  DATE_MARKER_LABELS,
  DateMarkerBadge,
  JUDGE_REQUEST_STATUS_LABELS,
  JudgeRequestStatusBadge,
  OFFICE_HOUR_STATUS_LABELS,
  OFFICE_HOUR_TYPE_LABELS,
  OfficeHourStatusBadge,
  OfficeHourTypeBadge,
  PARTICIPATION_STATUS_LABELS,
  ParticipationStatusBadge,
  RESCHEDULE_STATUS_LABELS,
  RescheduleStatusBadge,
  TEACHER_ASSIGNMENT_STATUS_LABELS,
  TEACHER_CONFIRMATION_STATUS_LABELS,
  TeacherAssignmentStatusBadge,
  TeacherConfirmationStatusBadge,
  TicketStatusBadge,
  getActiveStatusLabel,
  getActiveStatusVariant,
  getCompletionStatusVariant,
  getOfficeHourStatusMeta,
  getOfficeHourTypeLabel,
  getPriorityMeta,
  getRawStatusVariant,
  getTicketStatusMeta,
  normalizeStatusValue,
  RawStatusBadge,
} from './StatusMeta'
export type {
  AttendanceAlertKind,
  CompletionStatusKind,
  DateMarkerStatus,
  JudgeRequestStatus,
  ParticipationStatus,
  PriorityKind,
  RescheduleStatus,
  TeacherAssignmentStatus,
  TeacherConfirmationStatus,
  TicketStatusKind,
  TicketStatusMeta,
} from './StatusMeta'

// ─────────────────────────────────────────────────────────────────────────────
// ICONS  — single canonical set backed by lucide-react
// import from here, never inline per-page and never import lucide directly
// ─────────────────────────────────────────────────────────────────────────────
type P = { size?: number; color?: string; style?: React.CSSProperties }

export const Icon = {
  Menu:           (p?: P) => <_Menu            size={p?.size ?? 18} color={p?.color} />,
  Refresh:        (p?: P) => <RefreshCw         size={p?.size ?? 13} color={p?.color} />,
  Trash:          (p?: P) => <Trash2            size={p?.size ?? 13} color={p?.color} />,
  BarChart:       (p?: P) => <BarChart2         size={p?.size ?? 14} color={p?.color} />,
  Close:          (p?: P) => <_X               size={p?.size ?? 12} color={p?.color} />,
  ChevronDown:    (p?: P) => <_ChevronDown     size={p?.size ?? 11} color={p?.color} style={p?.style} />,
  ChevronLeft:    (p?: P) => <_ChevronLeft     size={p?.size ?? 16} color={p?.color} style={p?.style} />,
  ChevronRight:   (p?: P) => <_ChevronRight    size={p?.size ?? 16} color={p?.color} style={p?.style} />,
  Search:         (p?: P) => <_Search          size={p?.size ?? 14} color={p?.color ?? 'var(--text-quaternary)'} style={p?.style} />,
  Filter:         (p?: P) => <_Filter          size={p?.size ?? 12} color={p?.color} style={p?.style} />,
  Table:          (p?: P) => <Table2           size={p?.size ?? 15} color={p?.color} />,
  People:         (p?: P) => <_Users           size={p?.size ?? 15} color={p?.color} />,
  PieChart:       (p?: P) => <_PieChart        size={p?.size ?? 15} color={p?.color} />,
  User:           (p?: P) => <_User            size={p?.size ?? 12} color={p?.color} />,
  Monitor:        (p?: P) => <_Monitor         size={p?.size ?? 12} color={p?.color} />,
  Building:       (p?: P) => <Building2        size={p?.size ?? 12} color={p?.color} />,
  Users:          (p?: P) => <_Users           size={p?.size ?? 12} color={p?.color} />,
  MapPin:         (p?: P) => <_MapPin          size={p?.size ?? 12} color={p?.color} />,
  CheckCircle:    (p?: P) => <_CheckCircle     size={p?.size ?? 14} color={p?.color} />,
  XCircle:        (p?: P) => <_XCircle         size={p?.size ?? 14} color={p?.color} />,
  SortBoth:       (p?: P) => <ArrowUpDown      size={p?.size ?? 10} color={p?.color} style={{ opacity: 0.3, ...p?.style }} />,
  SortAsc:        (p?: P) => <ArrowUp          size={p?.size ?? 10} color={p?.color} style={p?.style} />,
  SortDesc:       (p?: P) => <ArrowDown        size={p?.size ?? 10} color={p?.color} style={p?.style} />,
  AlertTriangle:  (p?: P) => <_AlertTriangle   size={p?.size ?? 14} color={p?.color} />,
  AlertCircle:    (p?: P) => <_AlertCircle     size={p?.size ?? 14} color={p?.color} />,
  Edit:           (p?: P) => <Pencil           size={p?.size ?? 14} color={p?.color} />,
  Plus:           (p?: P) => <_Plus            size={p?.size ?? 14} color={p?.color} />,
  Repeat:         (p?: P) => <Repeat2          size={p?.size ?? 14} color={p?.color} />,
  UsersGroup:     (p?: P) => <UsersRound       size={p?.size ?? 14} color={p?.color} />,
  Bell:           (p?: P) => <_Bell            size={p?.size ?? 14} color={p?.color} />,
  BellOff:        (p?: P) => <_BellOff         size={p?.size ?? 14} color={p?.color} />,
  TrendingDown:   (p?: P) => <_TrendingDown    size={p?.size ?? 14} color={p?.color} />,
  TrendingUp:     (p?: P) => <_TrendingUp      size={p?.size ?? 14} color={p?.color} />,
  Clock:          (p?: P) => <_Clock           size={p?.size ?? 14} color={p?.color} />,
  Check:          (p?: P) => <_Check           size={p?.size ?? 14} color={p?.color} />,
  X:              (p?: P) => <_X               size={p?.size ?? 12} color={p?.color} />,
  Eye:            (p?: P) => <_Eye             size={p?.size ?? 14} color={p?.color} />,
  Download:       (p?: P) => <_Download        size={p?.size ?? 14} color={p?.color} />,
  Settings:       (p?: P) => <_Settings        size={p?.size ?? 14} color={p?.color} />,
  Info:           (p?: P) => <_Info            size={p?.size ?? 14} color={p?.color} />,
  GripVertical:   (p?: P) => <_GripVertical    size={p?.size ?? 16} color={p?.color} />,
  FileText:       (p?: P) => <_FileText        size={p?.size ?? 15} color={p?.color} />,
  Calendar:       (p?: P) => <_Calendar        size={p?.size ?? 15} color={p?.color} />,
  CalendarDays:   (p?: P) => <_CalendarDays    size={p?.size ?? 15} color={p?.color} />,
  ClipboardCheck: (p?: P) => <_ClipboardCheck  size={p?.size ?? 16} color={p?.color} />,
  Target:         (p?: P) => <_Target          size={p?.size ?? 16} color={p?.color} />,
  BookOpen:       (p?: P) => <_BookOpen        size={p?.size ?? 15} color={p?.color} />,
  Copy:           (p?: P) => <_Copy            size={p?.size ?? 14} color={p?.color} />,
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE ACTIONS — icon-only actions for dense admin tables
// ─────────────────────────────────────────────────────────────────────────────
export function TableActionGroup({ children }: { children: React.ReactNode }) {
  return <div className={styles.tableActionGroup}>{children}</div>
}

export function TableActionButton({
  label,
  icon,
  onClick,
  variant = 'neutral',
  disabled = false,
}: {
  label: string
  icon: React.ReactNode
  onClick: React.MouseEventHandler<HTMLButtonElement>
  variant?: 'neutral' | 'danger'
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`${styles.tableActionBtn} ${variant === 'danger' ? styles.tableActionBtnDanger : ''}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
    >
      {icon}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL GRID — modal/detail metadata blocks
// ─────────────────────────────────────────────────────────────────────────────
export function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className={styles.detailGrid}>{children}</div>
}

export function DetailField({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className={styles.detailFieldLabel}>{label}</div>
      {children}
    </div>
  )
}

export function DetailText({
  children,
  meta,
}: {
  children: React.ReactNode
  meta?: React.ReactNode
}) {
  return (
    <>
      <div className={styles.detailFieldValue}>{children}</div>
      {meta !== undefined && <div className={styles.detailFieldMeta}>{meta}</div>}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SORT ICON — inline column sort indicator
// ─────────────────────────────────────────────────────────────────────────────
export function SortIcon({
  col,
  sortKey,
  sortDir,
}: {
  col: string
  sortKey: string
  sortDir: 'asc' | 'desc'
}) {
  if (sortKey !== col) return <Icon.SortBoth />
  return sortDir === 'asc' ? <Icon.SortAsc /> : <Icon.SortDesc />
}

// ─────────────────────────────────────────────────────────────────────────────
// SPINNER — single canonical spinner
// ─────────────────────────────────────────────────────────────────────────────
export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      className={styles.spinner}
      style={{
        width: size,
        height: size,
        borderColor: 'rgba(0,0,0,0.08)',
        borderTopColor: 'var(--brand-indigo)',
        flexShrink: 0,
      }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST — fully managed hook + renderer
// ─────────────────────────────────────────────────────────────────────────────
export interface ToastInfo {
  id: number
  message: string
  type: 'success' | 'error' | 'info' | 'loading'
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastInfo[]>([])
  const nextId = useRef(0)

  const addToast = useCallback(
    (message: string, type: ToastInfo['type'] = 'info') => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, message, type }])
      if (type !== 'loading')
        setTimeout(
          () => setToasts((prev) => prev.filter((t) => t.id !== id)),
          4000,
        )
      return id
    },
    [],
  )

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}

export function ToastContainer({ 
  toasts, 
  onRemove 
}: { 
  toasts: ToastInfo[]
  onRemove?: (id: number) => void
}) {
  return (
    <div className={styles.toastContainer}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`${styles.toast} ${styles[t.type] ?? styles.info}`}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className={styles.toastContent}>
              {t.type === 'loading' && <Spinner />}
              <span className={styles.toastMessage}>{t.message}</span>
            </div>
            {onRemove && (
              <button
                className={styles.toastCloseButton}
                onClick={() => onRemove(t.id)}
                aria-label="Đóng thông báo"
              >
                <Icon.X size={10} />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-SELECT DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────
export interface SelectOption {
  value: string
  label: string
  searchTerms?: string[]
  isRegion?: boolean // Flag to identify region options
  regionCentreIds?: string[] // Centre IDs in this region (for checking if region is fully selected)
}

export function MultiSelect({
  options,
  selected = [],
  onChange,
  placeholder,
  maxDisplay = 2,
  searchable = false,
  displayFormat = 'text',
  menuPosition = 'bottom',
}: {
  options: SelectOption[]
  selected?: string[]
  onChange: (v: string[]) => void
  placeholder: string
  maxDisplay?: number
  searchable?: boolean
  displayFormat?: 'text' | 'chip'
  menuPosition?: 'bottom' | 'top' | 'fixed'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest(`.${styles.multiDropdownMenu}`)) return;
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  useEffect(() => {
    if (open && searchable) setTimeout(() => searchRef.current?.focus(), 30)
  }, [open, searchable])

  useLayoutEffect(() => {
    if (open && menuPosition === 'fixed' && buttonRef.current) {
      const update = () => {
        const rect = buttonRef.current?.getBoundingClientRect()
        if (rect) {
          setCoords({
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
          })
        }
      }
      update()
      window.addEventListener('resize', update)
      window.addEventListener('scroll', update, true)
      return () => {
        window.removeEventListener('resize', update)
        window.removeEventListener('scroll', update, true)
      }
    }
  }, [open, menuPosition])

  const filtered =
    searchable && query.trim()
      ? options.filter((o) => {
          const q = query.toLowerCase()
          return (
            o.label.toLowerCase().includes(q) ||
            (o.searchTerms ?? []).some((t) => t?.toLowerCase().includes(q))
          )
        })
      : options

  const toggle = (v: string) =>
    onChange(
      selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v],
    )

  const leafOptions = options.filter((o) => !o.isRegion)
  const isAll = leafOptions.length > 0 && leafOptions.every((o) => selected.includes(o.value))
  const selectAll = () => {
    if (isAll) {
      onChange([])
    } else {
      onChange(leafOptions.map((o) => o.value))
    }
    setQuery('')
  }

  const triggerLabel = isAll
    ? `Tất cả (${leafOptions.length})`
    : selected.length === 0
      ? placeholder
      : selected.length <= maxDisplay
        ? selected
            .map((v) => options.find((o) => o.value === v)?.label ?? v)
            .join(', ')
        : `${selected.length} đã chọn`

  const selectedItems = filtered.filter((opt) => selected.includes(opt.value))
  const unselectedItems = filtered.filter((opt) => !selected.includes(opt.value))

  const menuContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="multi-select-menu"
          className={styles.multiDropdownMenu}
          style={
            menuPosition === 'fixed'
              ? {
                  position: 'fixed',
                  top: coords.top,
                  left: coords.left,
                  width: coords.width,
                  zIndex: 9999999,
                }
              : {
                  top: menuPosition === 'top' ? 'auto' : 'calc(100% + 4px)',
                  bottom: menuPosition === 'top' ? 'calc(100% + 4px)' : 'auto',
                }
          }
          initial={{ opacity: 0, y: menuPosition === 'top' ? 6 : -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: menuPosition === 'top' ? 4 : -4, scale: 0.97 }}
          transition={{ duration: 0.12 }}
        >
          {searchable && (
            <div className={styles.dropdownSearch}>
              <Icon.Search size={12} color="var(--text-quaternary)" />
              <input
                ref={searchRef}
                type="text"
                className={styles.dropdownSearchInput}
                placeholder="Tìm kiếm..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              {query && (
                <button
                  className={styles.dropdownSearchClear}
                  onClick={() => setQuery('')}
                >
                  <Icon.X size={9} />
                </button>
              )}
            </div>
          )}

          {!query.trim() && (
            <>
              <label className={styles.dropdownItem}>
                <input
                  type="checkbox"
                  className={styles.reasonCheckbox}
                  checked={isAll}
                  onChange={selectAll}
                  readOnly
                />
                <span className={styles.dropdownItemLabel}>Tất cả</span>
              </label>
              <div className={styles.dropdownDivider} />
            </>
          )}

          {filtered.length === 0 ? (
            <div className={styles.dropdownEmpty}>Không tìm thấy kết quả</div>
          ) : (
            <>
              {!query.trim() && filtered.some((opt) => opt.isRegion) && (
                <>
                  <div className={styles.dropdownSectionLabel}>Chọn theo khu vực</div>
                  {filtered
                    .filter((opt) => opt.isRegion)
                    .map((opt) => {
                      const isRegionFullySelected = opt.regionCentreIds
                        ? opt.regionCentreIds.every((id) => selected.includes(id))
                        : false

                      return (
                        <label
                          key={opt.value}
                          className={styles.dropdownItem}
                          style={{ background: 'var(--bg-elevated)', fontWeight: 510 }}
                        >
                          <input
                            type="checkbox"
                            className={styles.reasonCheckbox}
                            checked={isRegionFullySelected}
                            onChange={() => toggle(opt.value)}
                          />
                          <span className={styles.dropdownItemLabel}>{opt.label}</span>
                        </label>
                      )
                    })}
                  <div className={styles.dropdownDivider} />
                </>
              )}

              <div className={styles.dropdownOptionsList}>
                {selectedItems.map((opt) => (
                  <label
                    key={opt.value}
                    className={`${styles.dropdownItem} ${styles.dropdownItemSelected}`}
                  >
                    <input
                      type="checkbox"
                      className={styles.reasonCheckbox}
                      checked={true}
                      onChange={() => toggle(opt.value)}
                    />
                    <span className={styles.dropdownItemLabel}>{opt.label}</span>
                  </label>
                ))}
                {unselectedItems
                  .filter((opt) => !opt.isRegion)
                  .map((opt) => (
                    <label key={opt.value} className={styles.dropdownItem}>
                      <input
                        type="checkbox"
                        className={styles.reasonCheckbox}
                        checked={false}
                        onChange={() => toggle(opt.value)}
                      />
                      <span className={styles.dropdownItemLabel}>{opt.label}</span>
                    </label>
                  ))}
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div ref={ref} className={styles.multiDropdown}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.multiDropdownTrigger} ${!isAll ? styles.triggerActive : ''}`}
        onClick={() => setOpen((p) => !p)}
      >
        <div className={styles.triggerLabelWrapper}>
          {displayFormat === 'chip' && !isAll ? (
            <div className={styles.triggerChips}>
              {selected.slice(0, maxDisplay).map((v) => (
                <span key={v} className={styles.selectChip}>
                  {options.find((o) => o.value === v)?.label ?? v}
                  <span
                    className={styles.chipClose}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggle(v)
                    }}
                  >
                    <Icon.X size={9} />
                  </span>
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

      {menuPosition === 'fixed' && mounted ? createPortal(menuContent, document.body) : menuContent}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RANGE SLIDER — dual thumb, 0–100
// ─────────────────────────────────────────────────────────────────────────────
export function RangeSlider({
  value = [0, 100],
  onChange,
  label = 'Tỷ lệ',
}: {
  value?: [number, number]
  onChange: (v: [number, number]) => void
  label?: string
}) {
  const [min, max] = Array.isArray(value) ? value : [0, 100]
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<'min' | 'max' | null>(null)
  const isAll = min === 0 && max === 100

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current || !trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      let pct = Math.round(((e.clientX - rect.left) / rect.width) * 100)
      pct = Math.max(0, Math.min(100, pct))
      if (dragging.current === 'min') onChange([Math.min(pct, max - 5), max])
      else onChange([min, Math.max(pct, min + 5)])
    },
    [min, max, onChange],
  )

  const handleMouseUp = useCallback(() => {
    dragging.current = null
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const pct = (v: number) => `${v}%`

  return (
    <div className={styles.rangeSliderWrap}>
      <div className={styles.rangeSliderLabel}>
        <Icon.Filter />
        <span>{label}</span>
        <span
          className={styles.rangeValue}
          style={{
            color: isAll ? 'var(--text-quaternary)' : 'var(--brand-indigo)',
          }}
        >
          {isAll ? 'Tất cả' : `${min}%–${max}%`}
        </span>
        {!isAll && (
          <button
            onClick={() => onChange([0, 100])}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-quaternary)',
              cursor: 'pointer',
              fontSize: 11,
              padding: '0 2px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Icon.X size={9} />
          </button>
        )}
      </div>
      <div ref={trackRef} className={styles.rangeTrack}>
        <div
          className={styles.rangeTrackFill}
          style={{
            left: pct(min),
            width: `${max - min}%`,
            background: isAll ? 'var(--border-primary)' : 'var(--brand-indigo)',
          }}
        />
        <div
          className={`${styles.rangeThumb} ${styles.rangeThumbLeft}`}
          style={{ left: pct(min) }}
          onMouseDown={() => {
            dragging.current = 'min'
          }}
        >
          <div className={styles.rangeThumbBubble}>{min}%</div>
        </div>
        <div
          className={`${styles.rangeThumb} ${styles.rangeThumbRight}`}
          style={{ left: pct(max) }}
          onMouseDown={() => {
            dragging.current = 'max'
          }}
        >
          <div className={styles.rangeThumbBubble}>{max}%</div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE RANGE PICKER
// ─────────────────────────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDate(iso: string): string {
  if (!iso) return ''
  const [y, m, day] = iso.split('-')
  const currentYear = new Date().getFullYear().toString()
  return y !== currentYear ? `${day}/${m}/${y}` : `${day}/${m}`
}

const DATE_PRESETS = [
  {
    label: 'Hôm nay',
    range: () => {
      const t = toDateStr(new Date())
      return { from: t, to: t }
    },
  },
  {
    label: 'Tuần này',
    range: () => {
      const today = new Date()
      const dow = today.getDay() === 0 ? 6 : today.getDay() - 1 // Mon=0
      const mon = new Date(today)
      mon.setDate(today.getDate() - dow)
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      return { from: toDateStr(mon), to: toDateStr(sun) }
    },
  },
  {
    label: 'Tháng này',
    range: () => {
      const now = new Date()
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { from: toDateStr(first), to: toDateStr(last) }
    },
  },
  {
    label: 'Tháng trước',
    range: () => {
      const now = new Date()
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: toDateStr(first), to: toDateStr(last) }
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// DATE RANGE INPUT — single field with inline calendar range picker
// ─────────────────────────────────────────────────────────────────────────────
export function DateRangeInput({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  label = "Thời gian",
  layout = "horizontal",
  menuPosition = "absolute"
}: {
  dateFrom: string
  dateTo: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  label?: string
  layout?: "horizontal" | "vertical"
  menuPosition?: "absolute" | "fixed" | "top"
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [tempStart, setTempStart] = useState<string | null>(null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useLayoutEffect(() => {
    if (open && menuPosition === 'fixed' && buttonRef.current) {
      const update = () => {
        const rect = buttonRef.current?.getBoundingClientRect()
        if (rect) {
          setCoords({
            top: rect.bottom + 4,
            left: rect.left,
            width: 340, // Standard calendar width
          })
        }
      }
      update()
      window.addEventListener('resize', update)
      window.addEventListener('scroll', update, true)
      return () => {
        window.removeEventListener('resize', update)
        window.removeEventListener('scroll', update, true)
      }
    }
  }, [open, menuPosition])

  // Format date for display (DD/MM/YYYY)
  const formatDateDisplay = useCallback((dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date)
  }, [])

  // Format display value
  const displayValue = useMemo(() => {
    if (!dateFrom && !dateTo) return ''
    if (dateFrom === dateTo) {
      return formatDateDisplay(dateFrom)
    }
    return `${formatDateDisplay(dateFrom)} - ${formatDateDisplay(dateTo)}`
  }, [dateFrom, dateTo, formatDateDisplay])

  // Generate calendar days for current month
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1 // Mon=0
    const daysInMonth = lastDay.getDate()

    const days: Array<{ date: Date; dateStr: string; isCurrentMonth: boolean }> = []

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i)
      days.push({ date, dateStr: toDateStr(date), isCurrentMonth: false })
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      days.push({ date, dateStr: toDateStr(date), isCurrentMonth: true })
    }

    // Next month days to fill the grid
    const remainingDays = 42 - days.length // 6 rows * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day)
      days.push({ date, dateStr: toDateStr(date), isCurrentMonth: false })
    }

    return days
  }, [currentMonth])

  const handleDateClick = useCallback((dateStr: string) => {
    if (tempStart === null) {
      // First click: set start date
      setTempStart(dateStr)
      onDateFromChange(dateStr)
      onDateToChange(dateStr)
    } else {
      // Second click: set end date and close
      if (dateStr < tempStart) {
        // User clicked earlier date, swap them
        onDateFromChange(dateStr)
        onDateToChange(tempStart)
      } else {
        // Normal case: end date after or equal to start date
        onDateToChange(dateStr)
      }
      setTempStart(null)
      setHoverDate(null)
      setOpen(false)
    }
  }, [tempStart, onDateFromChange, onDateToChange])

  const isInRange = useCallback((dateStr: string) => {
    if (!dateFrom || !dateTo) return false
    return dateStr >= dateFrom && dateStr <= dateTo
  }, [dateFrom, dateTo])

  const isHoverInRange = useCallback((dateStr: string) => {
    if (tempStart === null || !hoverDate) return false
    const start = tempStart < hoverDate ? tempStart : hoverDate
    const end = tempStart < hoverDate ? hoverDate : tempStart
    return dateStr >= start && dateStr <= end
  }, [tempStart, hoverDate])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setTempStart(null)
        setHoverDate(null)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setTempStart(null)
        setHoverDate(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  // Reset tempStart when opening
  useEffect(() => {
    if (open) {
      setTempStart(null)
      setHoverDate(null)
    }
  }, [open])

  const monthName = useMemo(() => {
    return new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(currentMonth)
  }, [currentMonth])

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const menuContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.dateRangePickerDropdown}
          style={
            menuPosition === 'fixed'
              ? {
                  position: 'fixed',
                  top: coords.top,
                  left: coords.left,
                  width: coords.width,
                  zIndex: 9999999,
                }
              : {
                  top: menuPosition === 'top' ? 'auto' : 'calc(100% + 4px)',
                  bottom: menuPosition === 'top' ? 'calc(100% + 4px)' : 'auto',
                }
          }
          initial={{ opacity: 0, y: menuPosition === 'top' ? 6 : -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: menuPosition === 'top' ? 4 : -4, scale: 0.97 }}
          transition={{ duration: 0.12 }}
        >
          {/* Quick presets */}
          <div className={styles.dateRangePresets}>
            {DATE_PRESETS.map((preset) => {
              const { from, to } = preset.range()
              const active = dateFrom === from && dateTo === to
              return (
                <button
                  key={preset.label}
                  type="button"
                  className={`${styles.dateRangePresetBtn} ${active ? styles.dateRangePresetActive : ''}`}
                  onClick={() => {
                    onDateFromChange(from)
                    onDateToChange(to)
                    setTempStart(null)
                    setHoverDate(null)
                    setOpen(false)
                  }}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          {/* Calendar */}
          <div className={styles.calendarContainer}>
            {/* Month navigation */}
            <div className={styles.calendarHeader}>
              <button
                type="button"
                className={styles.calendarNavBtn}
                onClick={goToPrevMonth}
              >
                <Icon.ChevronLeft size={14} />
              </button>
              <span className={styles.calendarMonthLabel}>{monthName}</span>
              <button
                type="button"
                className={styles.calendarNavBtn}
                onClick={goToNextMonth}
              >
                <Icon.ChevronRight size={14} />
              </button>
            </div>

            {/* Weekday headers */}
            <div className={styles.calendarWeekdays}>
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
                <div key={day} className={styles.calendarWeekday}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className={styles.calendarGrid}>
              {calendarDays.map(({ date, dateStr, isCurrentMonth }) => {
                const isStart = dateStr === (tempStart || dateFrom)
                const isEnd = tempStart === null && dateStr === dateTo
                const inRange = tempStart === null ? isInRange(dateStr) : false
                const hoverRange = isHoverInRange(dateStr)
                const isToday = dateStr === toDateStr(new Date())

                return (
                  <button
                    key={dateStr}
                    type="button"
                    className={`${styles.calendarDay} ${!isCurrentMonth ? styles.calendarDayOtherMonth : ''} ${isStart || isEnd ? styles.calendarDaySelected : ''} ${inRange || hoverRange ? styles.calendarDayInRange : ''} ${isToday ? styles.calendarDayToday : ''}`}
                    onClick={() => handleDateClick(dateStr)}
                    onMouseEnter={() => tempStart !== null && setHoverDate(dateStr)}
                    onMouseLeave={() => setHoverDate(null)}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div className={layout === 'vertical' ? styles.stackXs : styles.dateControls} style={layout === 'vertical' ? { gap: 'var(--space-1)', alignItems: 'flex-start' } : undefined}>
      <span className={styles.dateLabel}>{label}</span>
      <div ref={ref} className={styles.dateRangePickerContainer} style={{ width: layout === 'vertical' ? '100%' : undefined }}>
        <button
          ref={buttonRef}
          type="button"
          className={styles.dateRangePickerTrigger}
          onClick={() => setOpen(!open)}
          style={layout === 'vertical' ? { width: '100%' } : undefined}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ opacity: 0.6, flexShrink: 0 }}
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className={styles.dateRangePickerValue}>
            {displayValue || 'Chọn khoảng thời gian'}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              opacity: 0.5,
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
              flexShrink: 0
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {menuPosition === 'fixed' && mounted ? createPortal(menuContent, document.body) : menuContent}
      </div>
    </div>
  )
}

export function DateRangePicker({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: {
  dateFrom: string
  dateTo: string
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onOut = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOut)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOut)
    }
  }, [open])

  const label =
    !dateFrom && !dateTo
      ? 'Khoảng thời gian'
      : dateFrom === dateTo
        ? fmtDate(dateFrom)
        : `${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`

  return (
    <div ref={ref} className={styles.dateRangeWrapper}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${styles.dateRangeBtn} ${open ? styles.dateRangeBtnOpen : ''}`}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {label}
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{
            opacity: 0.5,
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 0.15s',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className={styles.dateRangePopover}>
          {/* Quick presets */}
          <div className={styles.dateRangePresets}>
            {DATE_PRESETS.map((p) => {
              const { from, to } = p.range()
              const active = dateFrom === from && dateTo === to
              return (
                <button
                  key={p.label}
                  type="button"
                  className={`${styles.dateRangePresetBtn} ${active ? styles.dateRangePresetActive : ''}`}
                  onClick={() => {
                    onDateFromChange(from)
                    onDateToChange(to)
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          <div className={styles.dateRangeInputRow}>
            <div className={styles.dateRangeInputGroup}>
              <span className={styles.dateLabel}>Từ</span>
              <input
                type="date"
                className={styles.dateInput}
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => onDateFromChange(e.target.value)}
              />
            </div>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
              style={{ opacity: 0.35, flexShrink: 0 }}
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            <div className={styles.dateRangeInputGroup}>
              <span className={styles.dateLabel}>Đến</span>
              <input
                type="date"
                className={styles.dateInput}
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => onDateToChange(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLBAR — standardised request filter bar
// Order (canonical): [Cơ sở] [│] [Date from-to] [│] [Tải dữ liệu] [Làm mới]
// ─────────────────────────────────────────────────────────────────────────────
export function Toolbar({
  centres,
  centreOptions,
  selectedCentres,
  onCentresChange,
  centresLoading,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onFetch,
  loading,
  progress,
  loadingText,
  hasData,
  onClearCache,
  onCancel,
  quickFilterSlots,
  filterToIds,
  showRegionQuickSelect = true,
}: {
  centres?: { id: string; shortName: string; name: string }[]
  centreOptions?: SelectOption[]
  selectedCentres: string[]
  onCentresChange: (v: string[]) => void
  centresLoading: boolean
  dateFrom: string
  dateTo: string
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
  onFetch: () => void
  loading: boolean
  progress?: { loaded: number; total: number }
  loadingText?: string
  hasData: boolean
  onClearCache: () => void
  onCancel?: () => void
  quickFilterSlots?: React.ReactNode
  filterToIds?: string[]
  showRegionQuickSelect?: boolean
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarRow}>
        {/* Cơ sở */}
        <div className={styles.dateControls}>
          <span className={styles.dateLabel}>Cơ sở</span>
          {centresLoading ? (
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-quaternary)',
                display: 'flex',
                gap: 'var(--space-2)',
                alignItems: 'center',
              }}
            >
              <Spinner size={12} />
              Đang tải...
            </span>
          ) : centres ? (
            <CentreSelectComponent
              centres={centres}
              selected={selectedCentres}
              onChange={onCentresChange}
              placeholder="Tất cả cơ sở"
              searchable
              maxDisplay={1}
              filterToIds={filterToIds}
              showRegionQuickSelect={showRegionQuickSelect}
            />
          ) : centreOptions ? (
            <MultiSelect
              options={centreOptions}
              selected={selectedCentres}
              onChange={onCentresChange}
              placeholder="Tất cả cơ sở"
              searchable
              maxDisplay={1}
            />
          ) : null}
        </div>

        <div className={styles.toolbarSeparator} />

        {/* Date range */}
        <DateRangeInput
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={onDateFromChange}
          onDateToChange={onDateToChange}
        />

        <div className={styles.toolbarSeparator} />

        {/* Quick Filter Slots */}
        {quickFilterSlots && (
          <>
            {quickFilterSlots}
            <div className={styles.toolbarSeparator} />
          </>
        )}

        {/* Actions: Làm mới dữ liệu (secondary) bên trái, Tải dữ liệu (primary) bên phải */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginLeft: 'auto',
          }}
        >
          {loading ? (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                }}
              >
                <Spinner />
                {progress && progress.total > 0
                  ? `Tải ${progress.loaded}/${progress.total}`
                  : progress && progress.loaded === 0 && progress.total === 0
                    ? 'Đang kết nối...'
                    : 'Đang khởi tạo...'}
              </div>
              {onCancel && (
                <button
                  className={styles.clearCacheBtn}
                  onClick={onCancel}
                  style={{
                    color: 'var(--status-error)',
                    borderColor: 'var(--status-error)',
                  }}
                >
                  <Icon.Close />
                  Dừng tải
                </button>
              )}
            </>
          ) : (
            <>
              {hasData && (
                <button className={styles.clearCacheBtn} onClick={onClearCache}>
                  <Icon.Trash />
                  Làm mới dữ liệu
                </button>
              )}
              <button
                className={styles.primaryBtn}
                onClick={onFetch}
                disabled={loading}
              >
                <Icon.Refresh />
                Tải dữ liệu
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  desc,
  valueColor,
  delay = 0,
}: {
  label: string
  value: string
  desc: string
  valueColor?: string
  delay?: number
}) {
  return (
    <motion.div
      className={styles.statCard}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <div className={styles.statLabel}>{label}</div>
      <div
        className={styles.statValue}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      <div className={styles.statDesc}>{desc}</div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI THRESHOLD SUGGESTIONS
// ─────────────────────────────────────────────────────────────────────────────
export type KPIThresholdSuggestionItem = {
  key: string
  target?: ReactNode
  content: ReactNode
  done?: boolean
}

export function KPIThresholdSuggestions({
  label,
  items,
  variant = 'goal',
  targetPosition = 'start',
  className,
}: {
  label: string
  items: KPIThresholdSuggestionItem[]
  variant?: 'goal' | 'warning'
  targetPosition?: 'start' | 'end'
  className?: string
}) {
  if (items.length === 0) return null

  const barClassName = [
    styles.suggestionsBar,
    variant === 'warning' ? styles.warningSuggestionsBar : '',
    className || '',
  ].filter(Boolean).join(' ')

  return (
    <div className={barClassName}>
      <span className={styles.suggestLabel}>{label}</span>
      {items.map(item => (
        <div
          key={item.key}
          className={[
            styles.suggestPill,
            item.done ? styles.suggestDone : '',
            variant === 'warning' ? styles.warningSuggestion : '',
          ].filter(Boolean).join(' ')}
        >
          {targetPosition === 'start' && item.target !== undefined && (
            <span className={styles.suggestTarget}>{item.target}</span>
          )}
          <span>{item.content}</span>
          {targetPosition === 'end' && item.target !== undefined && (
            <span className={styles.suggestTarget}>{item.target}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART SECTION HEADER — canonical title + optional toggle
// ─────────────────────────────────────────────────────────────────────────────
export function ChartSectionHeader({
  title,
  visible,
  onToggle,
}: {
  title: string
  visible?: boolean
  onToggle?: () => void
}) {
  return (
    <div className={styles.chartsSectionHeader}>
      <span className={styles.chartsSectionTitle}>
        <Icon.BarChart />
        {title}
      </span>
      {onToggle !== undefined && (
        <button
          onClick={onToggle}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            color: 'var(--text-tertiary)',
          }}
        >
          <span
            style={{
              transform: visible ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
              display: 'flex',
            }}
          >
            <Icon.ChevronDown />
          </span>
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE TOOLBAR — search + filters + range slider + clear
// ─────────────────────────────────────────────────────────────────────────────
export function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Tìm lớp học...',
  filterSlots,
  rangeValue,
  onRangeChange,
  rangeLabel = 'Tỷ lệ',
  quickFilterSlots,
  hasFilter,
  onClearFilter,
}: {
  search: string
  onSearchChange: (v: string) => void
  searchPlaceholder?: string
  /** Extra filter dropdowns rendered between search and range slider */
  filterSlots?: React.ReactNode
  rangeValue?: [number, number]
  onRangeChange?: (v: [number, number]) => void
  rangeLabel?: string
  quickFilterSlots?: React.ReactNode
  hasFilter: boolean
  onClearFilter: () => void
}) {
  return (
    <div className={styles.tableToolbar}>
      {/* Search */}
      <div className={styles.searchWrapper}>
        <span
          style={{
            position: 'absolute',
            left: 9,
            pointerEvents: 'none',
            display: 'flex',
          }}
        >
          <Icon.Search size={14} color="var(--text-quaternary)" />
        </span>
        <input
          type="text"
          className={styles.filterInput}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
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
          <RangeSlider
            value={rangeValue}
            onChange={onRangeChange}
            label={rangeLabel}
          />
        </>
      )}

      {/* Clear all filters */}
      {hasFilter && (
        <div style={{ marginLeft: 'auto' }}>
          <FilterChip onClick={onClearFilter}>
            Xoá bộ lọc
          </FilterChip>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN TABLE SECTION — reusable admin table container with consistent layout
// ─────────────────────────────────────────────────────────────────────────────
export function AdminTableSection({
  title,
  count,
  loading,
  progress,
  isExpanded,
  onToggle,
  actionSlot,
  toolbarSlot,
  children,
}: {
  title: string
  count?: number
  loading?: boolean
  progress?: { loaded: number; total: number }
  isExpanded: boolean
  onToggle?: () => void
  actionSlot?: React.ReactNode
  toolbarSlot?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className={styles.tableSection}>
      <TableGroupHeader
        title={title}
        count={count}
        loading={loading}
        progress={progress}
        isExpanded={isExpanded}
        onToggle={onToggle}
        actionSlot={actionSlot}
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
              <div className={styles.adminTableContent}>
                {toolbarSlot && (
                  <div className={styles.tablePanelBody} style={{ paddingBottom: 0 }}>
                    {toolbarSlot}
                  </div>
                )}
                <div className={styles.tableChildrenWrapper}>
                  {children}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN GRID SECTION — reusable admin grid container (for regions)
// ─────────────────────────────────────────────────────────────────────────────
export function AdminGridSection({
  title,
  count,
  loading,
  progress,
  isExpanded,
  onToggle,
  actionSlot,
  toolbarSlot,
  children,
}: {
  title: string
  count?: number
  loading?: boolean
  progress?: { loaded: number; total: number }
  isExpanded: boolean
  onToggle?: () => void
  actionSlot?: React.ReactNode
  toolbarSlot?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className={styles.tableSection}>
      <TableGroupHeader
        title={title}
        count={count}
        loading={loading}
        progress={progress}
        isExpanded={isExpanded}
        onToggle={onToggle}
        actionSlot={actionSlot}
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
              <div className={styles.tablePanelBody}>
                {toolbarSlot && <div style={{ marginBottom: 'var(--space-4)' }}>{toolbarSlot}</div>}
                {children}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN TOOLBAR — search + action button (right-aligned)
// ─────────────────────────────────────────────────────────────────────────────
export function AdminToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm...',
  actionLabel,
  onAction,
  actionIcon,
}: {
  search: string
  onSearchChange: (v: string) => void
  searchPlaceholder?: string
  actionLabel: string
  onAction: () => void
  actionIcon?: React.ReactNode
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarRow}>
        {/* Search */}
        <div className={styles.searchWrapper}>
          <span
            style={{
              position: 'absolute',
              left: 9,
              pointerEvents: 'none',
              display: 'flex',
            }}
          >
            <Icon.Search size={14} color="var(--text-quaternary)" />
          </span>
          <input
            type="text"
            className={styles.filterInput}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Action button - right aligned */}
        <button
          className={styles.primaryBtn}
          onClick={onAction}
          style={{ marginLeft: 'auto' }}
        >
          {actionIcon}
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE GROUP HEADER — section title + count badge (+ progress)
// ─────────────────────────────────────────────────────────────────────────────
export function TableGroupHeader({
  title,
  count,
  loading,
  progress,
  hasFilter,
  onClearFilter,
  note,
  isExpanded,
  onToggle,
  actionSlot,
  icon,
}: {
  title: string
  count?: number
  loading?: boolean
  progress?: { loaded: number; total: number }
  hasFilter?: boolean
  onClearFilter?: () => void
  note?: string
  isExpanded?: boolean
  onToggle?: () => void
  actionSlot?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className={styles.tableHeader}>
      <div
        className={styles.groupHeader}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          cursor: onToggle ? 'pointer' : 'default',
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
          {icon && <span style={{ color: 'var(--brand-indigo)', display: 'flex', alignItems: 'center' }}>{icon}</span>}
          <span className={styles.groupTitle} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>
          {!loading && count !== undefined && (
            <span className={styles.groupBadge}>{count}</span>
          )}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {progress ? (
                 <span className={`${styles.groupBadge} ${styles.loadingBadge}`}>
                   {progress.loaded}/{progress.total}
                 </span>
              ) : (
                 <Spinner size={12} />
              )}
            </div>
          )}
          {hasFilter && onClearFilter && (
            <button
              onClick={(e) => { e.stopPropagation(); onClearFilter(); }}
              className={styles.clearFilterBtn}
              style={{
                fontSize: 12,
                color: 'var(--brand-indigo)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Xoá bộ lọc
            </button>
          )}
        </div>

        <div 
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
          onClick={e => e.stopPropagation()} // Prevent toggling when clicking actions
        >
          {actionSlot}
          {note && (
            <span style={{ fontSize: 11, color: 'var(--text-quaternary)', fontWeight: 400 }}>
              {note}
            </span>
          )}
          {onToggle && (
            <span
              style={{
                transform: isExpanded ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
                color: 'var(--text-tertiary)',
                display: 'flex',
              }}
            >
              <Icon.ChevronDown size={14} />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function SubTableGroupHeader({
  title,
  count,
  icon,
  isExpanded = true,
  onToggle,
  color,
}: {
  title: string
  count?: number
  icon?: React.ReactNode
  isExpanded?: boolean
  onToggle?: () => void
  color?: string
}) {
  const activeColor = color || 'var(--brand-indigo)';
  return (
    <div
      style={{
        padding: '10px 16px',
        background: 'var(--bg-elevated)',
        fontSize: 11,
        fontWeight: 700,
        color: activeColor,
        borderBottom: '1px solid var(--border-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        letterSpacing: '0.02em',
        cursor: onToggle ? 'pointer' : 'default',
        userSelect: 'none',
      }}
      onClick={onToggle}
    >
      {onToggle && (
        <motion.span
          animate={{ rotate: isExpanded ? 0 : -90 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <Icon.ChevronDown size={14} />
        </motion.span>
      )}
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </span>
      {typeof count === 'number' && (
        <span
          style={{
            fontSize: 10,
            padding: '1px 5px',
            borderRadius: 4,
            background: activeColor,
            color: 'white',
            flexShrink: 0
          }}
        >
          {count}
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon?: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '64px 24px',
        color: 'var(--text-quaternary)',
      }}
    >
      {icon && (
        <div
          style={{
            margin: '0 auto var(--space-4)',
            display: 'flex',
            justifyContent: 'center',
            opacity: 0.4,
          }}
        >
          {icon}
        </div>
      )}
      <div
        style={{
          fontSize: 14,
          fontWeight: 510,
          color: 'var(--text-secondary)',
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 13, marginTop: 'var(--space-1)' }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL WRAPPER — animated overlay + content container
// ─────────────────────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  children,
  maxWidth = 'min(1200px, calc(100vw - 40px))',
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}) {
  // ESC key handler
  useEffect(() => {
    if (!open) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.modalOverlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: '20px',
          }}
        >
          <motion.div
            className={styles.modalContent}
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
            style={{
              width: '100%',
              maxWidth,
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string
  subtitle?: string
  onClose: () => void
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
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE LAYOUT — sidebar + header + main
// Accepts sidebar nav items as children, rendering the standard shell
// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — shared across pages
// ─────────────────────────────────────────────────────────────────────────────
export function initials(name: string): string {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function defaultMonthRange(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    from: `${first.getFullYear()}-${pad2(first.getMonth() + 1)}-${pad2(first.getDate())}`,
    to: `${last.getFullYear()}-${pad2(last.getMonth() + 1)}-${pad2(last.getDate())}`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sortable Table Header Component
// ─────────────────────────────────────────────────────────────────────────────

interface SortableHeaderProps {
  label: string
  sortKey: string
  currentSortKey: string
  sortOrder: 'asc' | 'desc'
  onSort: (key: string) => void
  style?: React.CSSProperties
  className?: string
}

export function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  sortOrder,
  onSort,
  style,
  className,
}: SortableHeaderProps) {
  const isActive = currentSortKey === sortKey

  return (
    <th
      className={className}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        ...style,
      }}
      onClick={() => onSort(sortKey)}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
      >
        <span>{label}</span>
        {isActive ? (
          sortOrder === 'asc' ? (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          ) : (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )
        ) : (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ opacity: 0.3 }}
          >
            <polyline points="18 15 12 9 6 15" />
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </div>
    </th>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sortable Column Header (for grid-based tables)
// ─────────────────────────────────────────────────────────────────────────────

interface SortableColumnProps {
  label: string
  sortKey: string
  currentSortKey: string
  sortOrder: 'asc' | 'desc'
  onSort: (key: string) => void
  className?: string
}

export function SortableColumn({
  label,
  sortKey,
  currentSortKey,
  sortOrder,
  onSort,
  className,
}: SortableColumnProps) {
  const isActive = currentSortKey === sortKey

  return (
    <div
      className={`${className || ''} ${isActive ? 'active-sort' : ''}`}
      onClick={() => onSort(sortKey)}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
      }}
    >
      <span>{label}</span>
      {isActive ? (
        sortOrder === 'asc' ? (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        ) : (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )
      ) : (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ opacity: 0.3 }}
        >
          <polyline points="18 15 12 9 6 15" />
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// USER SEARCH INPUT — Reusable search input with dropdown
// ─────────────────────────────────────────────────────────────────────────────
export { UserSearchInput, type UserSearchResult } from './UserSearchInput'

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT REQUEST SUGGESTIONS — Display teachers who requested shifts
// ─────────────────────────────────────────────────────────────────────────────
export {
  ShiftRequestSuggestions,
  type ShiftRequest,
} from './ShiftRequestSuggestions'

// ─────────────────────────────────────────────────────────────────────────────
// MODAL FOOTER — Reusable modal footer with action buttons
// ─────────────────────────────────────────────────────────────────────────────
export { ModalFooter, type ModalFooterButton } from './ModalFooter'

// CENTRE SELECT — Reusable centre selection component
// ─────────────────────────────────────────────────────────────────────────────
export { CentreSelect, type Centre } from './CentreSelect'

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM DIALOG — Reusable confirmation modal
// ─────────────────────────────────────────────────────────────────────────────
export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog'

// ─────────────────────────────────────────────────────────────────────────────
// QUICK FILTER CHIPS — Auto-generated filter chips from user preferences
// ─────────────────────────────────────────────────────────────────────────────
export { QuickFilterChips } from './QuickFilterChips'
export { FilterChip } from './FilterChip'

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT BUTTON — CSV export button with settings
// ─────────────────────────────────────────────────────────────────────────────
export { ExportButton } from './ExportButton'
export { CSVExportSettings } from './CSVExportSettings'
export type { CSVColumnConfig } from './CSVExportSettings'

// ─────────────────────────────────────────────────────────────────────────────
// COMPACT SELECT
// ─────────────────────────────────────────────────────────────────────────────
export function CompactSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  menuPosition = "absolute"
}: {
  label?: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  menuPosition?: "absolute" | "fixed" | "top"
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useLayoutEffect(() => {
    if (open && menuPosition === 'fixed' && buttonRef.current) {
      const update = () => {
        const rect = buttonRef.current?.getBoundingClientRect()
        if (rect) {
          setCoords({
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
          })
        }
      }
      update()
      window.addEventListener('resize', update)
      window.addEventListener('scroll', update, true)
      return () => {
        window.removeEventListener('resize', update)
        window.removeEventListener('scroll', update, true)
      }
    }
  }, [open, menuPosition])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const selectedLabel = options.find(o => String(o.value).toUpperCase() === String(value).toUpperCase())?.label || value

  const menuContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.12 }}
          className={styles.multiDropdownMenu}
          style={
            menuPosition === 'fixed'
              ? {
                  position: 'fixed',
                  top: coords.top,
                  left: coords.left,
                  minWidth: Math.max(160, coords.width),
                  maxHeight: '250px',
                  padding: '4px',
                  zIndex: 9999999
                }
              : { 
                  minWidth: '160px', 
                  maxHeight: '250px',
                  padding: '4px'
                }
          }
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`${styles.dropdownItem} ${value === opt.value ? styles.dropdownItemSelected : ''}`}
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              style={{
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: value === opt.value ? 600 : 500,
                color: value === opt.value ? 'var(--brand-indigo)' : 'var(--text-secondary)',
                background: value === opt.value ? 'rgba(94, 106, 210, 0.06)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>{opt.label}</span>
              {value === opt.value && <Icon.Check size={12} />}
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div ref={ref} className={styles.compactSelectWrapper} style={{ position: 'relative' }}>
      {label && <span className={styles.compactSelectLabel}>{label}:</span>}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(!open)}
          className={`${styles.multiDropdownTrigger} ${open ? styles.triggerActive : ''}`}
          style={{ 
            padding: '4px 10px', 
            minWidth: '100px', 
            height: '28px', 
            fontSize: '12px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedLabel}
          </span>
          <Icon.ChevronDown 
            size={12} 
            style={{ 
              opacity: 0.5, 
              transform: open ? 'rotate(180deg)' : 'none', 
              transition: 'transform 0.15s ease' 
            }} 
          />
        </button>

        {menuPosition === 'fixed' && mounted ? createPortal(menuContent, document.body) : menuContent}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW MODE TOGGLE
// ─────────────────────────────────────────────────────────────────────────────
export function ViewModeToggle<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: readonly { value: T; label: string; icon?: React.ReactNode }[]
  onChange: (value: T) => void
}) {
  return (
    <div className={styles.viewModeToggle}>
      {options.map((opt) => {
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`${styles.viewModeBtn} ${isActive ? styles.viewModeBtnActive : ''}`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

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

// Added React.memo

/* Updated styles */
