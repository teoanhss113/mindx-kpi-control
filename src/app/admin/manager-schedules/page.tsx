'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageLayout } from '@/components/PageLayout';
import { ProtectedPage } from '@/components/ProtectedPage';
import {
  AdminTableSection,
  Badge,
  CentreBadge,
  EmptyState,
  Icon,
  KPIStatCard,
  ToastContainer,
  Toolbar,
  useToast,
  type SelectOption,
} from '@/components/ui';
import { getCache, setCache } from '@/lib/idb';
import { fetchAllCentres, type Centre } from '@/services/centresService';
import { deleteManagerSchedule, fetchManagerScheduleProfiles, fetchManagerSchedules } from '@/services/managerScheduleService';
import {
  CACHE_KEYS,
  CHART_COLORS,
  FORMAT,
  LABELS,
  MANAGER_REQUIRED_WEEKDAYS,
  MANAGER_SCHEDULE_LABELS,
  MANAGER_WORK_SESSIONS,
  MESSAGES,
  WEEKDAY_OPTIONS,
} from '@/constants';
import { useSharedDateRange, useSharedCentres } from '@/hooks/useSharedFilterState';
import type { ManagerScheduleProfile, ManagerScheduleRegistration, ManagerWorkSession } from '@/types/managerSchedule';
import styles from '@/app/dashboard.module.css';

const SESSION_COLORS: Record<ManagerWorkSession, string> = {
  morning: CHART_COLORS.PALETTE[0],
  afternoon: CHART_COLORS.PALETTE[2],
  evening: CHART_COLORS.PALETTE[3],
};

function toDateInputValue(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(dateValue: string) {
  return FORMAT.date(new Date(`${dateValue}T00:00:00`));
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function getWeekStart(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return toDateInputValue(date);
}

function getSessionLabel(session: ManagerWorkSession) {
  return MANAGER_WORK_SESSIONS.find(item => item.value === session)?.label ?? session;
}

function getWeekdayLabel(dateValue: string) {
  const weekday = new Date(`${dateValue}T00:00:00`).getDay();
  return WEEKDAY_OPTIONS.find(item => item.value === weekday)?.label ?? '';
}

function getWeekdayLabelByValue(weekday: number) {
  return WEEKDAY_OPTIONS.find(item => item.value === weekday)?.label ?? '';
}

function isRequiredWeekend(dateValue: string) {
  const weekday = new Date(`${dateValue}T00:00:00`).getDay();
  return MANAGER_REQUIRED_WEEKDAYS.includes(weekday as typeof MANAGER_REQUIRED_WEEKDAYS[number]);
}

function formatShortDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-');
  return `${day}/${month}/${year}`;
}

function getManagerDisplayName(manager: ManagerScheduleProfile) {
  return manager.fullName || manager.username || manager.name || manager.email.split('@')[0] || manager.email;
}

function ManagerSchedulesAdminPageInner() {
  const { toasts, addToast, removeToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [managers, setManagers] = useState<ManagerScheduleProfile[]>([]);
  const [schedules, setSchedules] = useState<ManagerScheduleRegistration[]>([]);
  const [complianceSchedules, setComplianceSchedules] = useState<ManagerScheduleRegistration[]>([]);
  const [tableExpanded, setTableExpanded] = useState(true);
  const [missingExpanded, setMissingExpanded] = useState(true);
  const [mobilityExpanded, setMobilityExpanded] = useState(true);
  const [tableQuery, setTableQuery] = useState('');
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => getWeekStart(toDateInputValue(new Date())));
  const [loading, setLoading] = useState(false);

  const [dateFrom, dateTo, setDateFrom, setDateTo] = useSharedDateRange();
  const [selectedCentres, setSelectedCentres] = useSharedCentres();

  useEffect(() => {
    const now = new Date();
    if (!dateFrom) setDateFrom(toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)));
    if (!dateTo) setDateTo(toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  }, [dateFrom, dateTo, setDateFrom, setDateTo]);

  useEffect(() => {
    if (!dateFrom) return;
    const timer = window.setTimeout(() => setCalendarWeekStart(getWeekStart(dateFrom)), 0);
    return () => window.clearTimeout(timer);
  }, [dateFrom]);

  useEffect(() => {
    (async () => {
      try {
        const cached = await getCache(CACHE_KEYS.CENTRES);
        if (cached?.centres?.length) {
          setCentres(cached.centres);
          return;
        }
        const data = await fetchAllCentres();
        setCentres(data);
        await setCache(CACHE_KEYS.CENTRES, { centres: data });
      } catch (error) {
        console.error('Failed to load centres:', error);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchManagerScheduleProfiles();
        const { enrichProfiles } = await import('@/services/userEnrichmentService');
        const enriched = await enrichProfiles(data.map(manager => ({
          id: manager.id,
          email: manager.email,
          role: 'manager' as const,
          is_active: true,
          created_at: '',
        })));

        const enrichedByEmail = enriched.reduce<Record<string, typeof enriched[number]>>((acc, user) => {
          acc[user.email.toLowerCase()] = user;
          return acc;
        }, {});

        setManagers(data.map(manager => {
          const enrichedUser = enrichedByEmail[manager.email.toLowerCase()];
          return {
            ...manager,
            username: enrichedUser?.username || '',
            fullName: enrichedUser?.full_name || '',
            name: enrichedUser?.full_name || enrichedUser?.username || manager.name,
          };
        }));
      } catch (error) {
        console.error('Failed to load manager profiles:', error);
        addToast(error instanceof Error ? error.message : MESSAGES.ERROR.GENERIC, 'error');
      }
    })();
  }, [addToast]);

  const centreOptions = useMemo<SelectOption[]>(
    () => centres.map(centre => ({
      value: centre.id,
      label: centre.shortName || centre.name,
      searchTerms: [centre.name, centre.shortName],
    })),
    [centres],
  );

  const loadSchedules = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    try {
      const [data, complianceData] = await Promise.all([
        fetchManagerSchedules({
          dateFrom,
          dateTo,
          centreIds: selectedCentres,
          admin: true,
        }),
        fetchManagerSchedules({
          dateFrom,
          dateTo,
          admin: true,
        }),
      ]);
      setSchedules(data);
      setComplianceSchedules(complianceData);
    } catch (error) {
      console.error('Failed to load manager schedules:', error);
      addToast(error instanceof Error ? error.message : MESSAGES.ERROR.GENERIC, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, dateFrom, dateTo, selectedCentres]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSchedules(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSchedules]);

  const filteredSchedules = useMemo(() => {
    const query = tableQuery.trim().toLowerCase();
    return schedules.filter(item => !query || [
      item.managerName,
      item.managerEmail,
      item.centreName,
      item.centreShortName,
      getSessionLabel(item.session),
      item.note || '',
    ].some(value => value.toLowerCase().includes(query)));
  }, [schedules, tableQuery]);

  const managerProfilesByEmail = useMemo(() => {
    return managers.reduce<Record<string, ManagerScheduleProfile>>((acc, manager) => {
      acc[manager.email.toLowerCase()] = manager;
      return acc;
    }, {});
  }, [managers]);

  const getManagerName = useCallback((email: string, fallback?: string) => {
    const profile = managerProfilesByEmail[email.toLowerCase()];
    return profile ? getManagerDisplayName(profile) : fallback || email.split('@')[0] || email;
  }, [managerProfilesByEmail]);

  const getManagerRoleText = useCallback((email: string) => {
    return managerProfilesByEmail[email.toLowerCase()]?.roleName || '—';
  }, [managerProfilesByEmail]);

  const getManagerRegionText = useCallback((email: string) => {
    const regionNames = managerProfilesByEmail[email.toLowerCase()]?.regionNames || [];
    return regionNames.length ? regionNames.join(', ') : 'Chưa gán khu vực';
  }, [managerProfilesByEmail]);

  const stats = useMemo(() => {
    const managerIds = new Set(filteredSchedules.map(item => item.managerId));
    const centreCounts = filteredSchedules.reduce<Record<string, { name: string; count: number }>>((acc, item) => {
      const key = item.centreId;
      acc[key] = acc[key] ?? { name: item.centreShortName || item.centreName, count: 0 };
      acc[key].count += 1;
      return acc;
    }, {});
    const busiestCentre = Object.values(centreCounts).sort((a, b) => b.count - a.count)[0];

    return {
      total: filteredSchedules.length,
      managers: managerIds.size,
      busiestCentre,
      avgPerManager: managerIds.size ? filteredSchedules.length / managerIds.size : 0,
    };
  }, [filteredSchedules]);

  const requiredWeekendDates = useMemo(() => {
    if (!dateFrom || !dateTo) return [];

    const dates: string[] = [];
    for (let current = dateFrom; current <= dateTo; current = addDays(current, 1)) {
      if (isRequiredWeekend(current)) dates.push(current);
    }
    return dates;
  }, [dateFrom, dateTo]);

  const weekendCompliance = useMemo(() => {
    const scheduleDatesByManager = complianceSchedules.reduce<Record<string, Set<string>>>((acc, item) => {
      const key = item.managerEmail.toLowerCase();
      acc[key] = acc[key] ?? new Set<string>();
      acc[key].add(item.date);
      return acc;
    }, {});

    const missingByManager = managers.map(manager => {
      const registeredDates = scheduleDatesByManager[manager.email.toLowerCase()] ?? new Set<string>();
      const missingDates = requiredWeekendDates.filter(date => !registeredDates.has(date));
      return { manager, missingDates };
    }).filter(item => item.missingDates.length > 0);

    const compliantManagers = managers.filter(manager => {
      const registeredDates = scheduleDatesByManager[manager.email.toLowerCase()] ?? new Set<string>();
      return requiredWeekendDates.every(date => registeredDates.has(date));
    });

    return {
      missingByManager,
      compliantManagers,
      requiredDates: requiredWeekendDates.length,
    };
  }, [complianceSchedules, managers, requiredWeekendDates]);

  const mobilityStats = useMemo(() => {
    const byManager = complianceSchedules.reduce<Record<string, {
      managerEmail: string;
      managerName: string;
      regionText: string;
      weekKeys: Set<string>;
      patternWeeks: Record<string, { centreName: string; weekday: number; session: ManagerWorkSession; weeks: Set<string> }>;
    }>>((acc, item) => {
      const managerKey = item.managerEmail.toLowerCase();
      const weekKey = getWeekStart(item.date);
      const patternKey = `${item.centreId}:${item.weekday}:${item.session}`;

      acc[managerKey] = acc[managerKey] ?? {
        managerEmail: item.managerEmail,
        managerName: getManagerName(item.managerEmail, item.managerName),
        regionText: getManagerRegionText(item.managerEmail),
        weekKeys: new Set<string>(),
        patternWeeks: {},
      };
      acc[managerKey].weekKeys.add(weekKey);
      acc[managerKey].patternWeeks[patternKey] = acc[managerKey].patternWeeks[patternKey] ?? {
        centreName: item.centreShortName || item.centreName || item.centreId,
        weekday: item.weekday,
        session: item.session,
        weeks: new Set<string>(),
      };
      acc[managerKey].patternWeeks[patternKey].weeks.add(weekKey);
      return acc;
    }, {});

    return Object.values(byManager)
      .map(item => {
        const registeredWeeks = item.weekKeys.size;
        const patterns = Object.values(item.patternWeeks)
          .filter(pattern => pattern.weeks.size >= 2)
          .sort((a, b) => b.weeks.size - a.weeks.size || a.centreName.localeCompare(b.centreName));
        const strongestRepeatedWeeks = patterns[0]?.weeks.size ?? 0;

        return {
          managerEmail: item.managerEmail,
          managerName: item.managerName,
          regionText: item.regionText,
          patterns: patterns.map(pattern => ({
            centreName: pattern.centreName,
            weekday: pattern.weekday,
            session: pattern.session,
            repeatedWeeks: pattern.weeks.size,
          })),
          registeredWeeks,
          repeatedWeeks: strongestRepeatedWeeks,
          repeatRate: registeredWeeks ? strongestRepeatedWeeks / registeredWeeks : 0,
        };
      })
      .filter(item => item.registeredWeeks >= 2 && item.patterns.length > 0)
      .sort((a, b) => (b.patterns.length - a.patterns.length) || (b.repeatRate - a.repeatRate) || (b.repeatedWeeks - a.repeatedWeeks) || a.managerName.localeCompare(b.managerName));
  }, [complianceSchedules, getManagerName, getManagerRegionText]);

  const chartData = useMemo(() => {
    const byCentre = Object.values(filteredSchedules.reduce<Record<string, { name: string; total: number }>>((acc, item) => {
      const key = item.centreId;
      acc[key] = acc[key] ?? { name: item.centreShortName || item.centreName, total: 0 };
      acc[key].total += 1;
      return acc;
    }, {})).sort((a, b) => b.total - a.total);

    const byManager = Object.values(filteredSchedules.reduce<Record<string, { name: string; total: number }>>((acc, item) => {
      const key = item.managerId;
      acc[key] = acc[key] ?? { name: getManagerName(item.managerEmail, item.managerName), total: 0 };
      acc[key].total += 1;
      return acc;
    }, {})).sort((a, b) => b.total - a.total).slice(0, 10);

    const bySession = MANAGER_WORK_SESSIONS.map(session => ({
      name: session.label,
      session: session.value,
      total: filteredSchedules.filter(item => item.session === session.value).length,
    }));

    return { byCentre, byManager, bySession };
  }, [filteredSchedules, getManagerName]);

  const calendarWeekDates = useMemo(() => (
    Array.from({ length: 7 }, (_, index) => addDays(calendarWeekStart, index))
  ), [calendarWeekStart]);

  const schedulesBySlot = useMemo(() => {
    return filteredSchedules.reduce<Record<string, ManagerScheduleRegistration[]>>((acc, item) => {
      const key = `${item.date}:${item.session}`;
      acc[key] = acc[key] ?? [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [filteredSchedules]);

  const handleDelete = async (id: string) => {
    try {
      await deleteManagerSchedule(id, true);
      await loadSchedules();
      addToast('Đã xoá lịch làm việc', 'success');
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      addToast(MESSAGES.ERROR.GENERIC, 'error');
    }
  };

  return (
    <ProtectedPage pageKey={['admin-manager-schedules', 'admin-users']}>
      <PageLayout
        title={MANAGER_SCHEDULE_LABELS.STATS_SECTION}
        activePage="admin-manager-schedules"
        sidebarOpen={sidebarOpen}
        onSidebarToggle={setSidebarOpen}
      >
        <Toolbar
          centres={centres}
          centreOptions={centreOptions}
          selectedCentres={selectedCentres}
          onCentresChange={setSelectedCentres}
          centresLoading={centres.length === 0}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onFetch={loadSchedules}
          loading={loading}
          hasData={schedules.length > 0}
          onClearCache={() => {
            setSelectedCentres([]);
            setTableQuery('');
          }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <KPIStatCard label={MANAGER_SCHEDULE_LABELS.TOTAL_SHIFTS} value={FORMAT.number(stats.total)} desc="Theo bộ lọc hiện tại" icon={<Icon.CalendarDays />} />
          <KPIStatCard label={MANAGER_SCHEDULE_LABELS.ACTIVE_MANAGERS} value={FORMAT.number(stats.managers)} desc={`${stats.avgPerManager.toFixed(1)} buổi/quản lý`} icon={<Icon.People />} delay={0.04} />
          <KPIStatCard label={MANAGER_SCHEDULE_LABELS.BUSIEST_CENTRE} value={stats.busiestCentre?.name ?? '—'} desc={stats.busiestCentre ? `${stats.busiestCentre.count} buổi` : 'Chưa có dữ liệu'} icon={<Icon.Building />} delay={0.08} />
          <KPIStatCard
            label={MANAGER_SCHEDULE_LABELS.WEEKEND_MISSING}
            value={FORMAT.number(weekendCompliance.missingByManager.length)}
            desc={`${FORMAT.number(weekendCompliance.requiredDates)} ${MANAGER_SCHEDULE_LABELS.WEEKEND_REQUIRED_DAYS.toLowerCase()}`}
            icon={<Icon.AlertTriangle />}
            valueColor={weekendCompliance.missingByManager.length > 0 ? 'var(--status-warning)' : 'var(--status-success)'}
            delay={0.12}
          />
          <KPIStatCard
            label={MANAGER_SCHEDULE_LABELS.LOW_MOBILITY}
            value={FORMAT.number(mobilityStats.length)}
            desc={MANAGER_SCHEDULE_LABELS.LOW_MOBILITY_DESC}
            icon={<Icon.Building />}
            valueColor={mobilityStats.length > 0 ? 'var(--status-warning)' : 'var(--status-success)'}
            delay={0.16}
          />
        </div>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <AdminTableSection
            title={MANAGER_SCHEDULE_LABELS.WEEKEND_MISSING_TABLE}
            count={weekendCompliance.missingByManager.length}
            loading={loading}
            isExpanded={missingExpanded}
            onToggle={() => setMissingExpanded(value => !value)}
          >
          <div className={styles.tableScrollWrapper}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,0.7fr) minmax(0,1fr) minmax(0,1.5fr) minmax(0,0.7fr)', minWidth: 980, padding: '7px 16px', borderBottom: '1px solid var(--border-primary)', fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', letterSpacing: '0.04em', textTransform: 'uppercase', background: 'var(--bg-elevated)' }}>
              <div>{MANAGER_SCHEDULE_LABELS.MANAGER}</div>
              <div>{MANAGER_SCHEDULE_LABELS.ROLE}</div>
              <div>{MANAGER_SCHEDULE_LABELS.MANAGER_REGION}</div>
              <div>{MANAGER_SCHEDULE_LABELS.MISSING_DATES}</div>
              <div>{LABELS.STATUS}</div>
            </div>
            {weekendCompliance.missingByManager.map(item => (
              <div key={item.manager.email} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,0.7fr) minmax(0,1fr) minmax(0,1.5fr) minmax(0,0.7fr)', minWidth: 980, padding: '10px 16px', borderBottom: '1px solid var(--border-primary)', alignItems: 'center', background: 'var(--bg-surface)' }}>
                <div className={styles.className}>
                  {getManagerDisplayName(item.manager)}
                  <span className={styles.centreName}>{item.manager.email}</span>
                </div>
                <div><Badge variant="default" size="sm" shape="rounded">{item.manager.roleName || '—'}</Badge></div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.manager.regionNames.length ? item.manager.regionNames.join(', ') : 'Chưa gán khu vực'}</div>
                <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                  {item.missingDates.map(date => (
                    <Badge key={date} variant="warning" size="sm" shape="rounded">
                      {getWeekdayLabel(date)} · {formatDate(date)}
                    </Badge>
                  ))}
                </div>
                <div><Badge variant="warning" size="sm" shape="rounded">{MANAGER_SCHEDULE_LABELS.MISSING_STATUS}</Badge></div>
              </div>
            ))}
            {weekendCompliance.missingByManager.length === 0 && (
              <EmptyState
                icon={<Icon.CheckCircle size={32} />}
                title={MANAGER_SCHEDULE_LABELS.ALL_WEEKEND_REGISTERED}
                subtitle={MANAGER_SCHEDULE_LABELS.WEEKEND_MISSING_DESC}
              />
            )}
          </div>
          </AdminTableSection>
        </div>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <AdminTableSection
            title={MANAGER_SCHEDULE_LABELS.LOW_MOBILITY_TABLE}
            count={mobilityStats.length}
            loading={loading}
            isExpanded={mobilityExpanded}
            onToggle={() => setMobilityExpanded(value => !value)}
          >
          <div className={styles.tableScrollWrapper}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,0.7fr) minmax(0,1fr) minmax(0,2fr) minmax(0,0.7fr) minmax(0,0.7fr) minmax(0,0.6fr)', minWidth: 1180, padding: '7px 16px', borderBottom: '1px solid var(--border-primary)', fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)', letterSpacing: '0.04em', textTransform: 'uppercase', background: 'var(--bg-elevated)' }}>
              <div>{MANAGER_SCHEDULE_LABELS.MANAGER}</div>
              <div>{MANAGER_SCHEDULE_LABELS.ROLE}</div>
              <div>{MANAGER_SCHEDULE_LABELS.MANAGER_REGION}</div>
              <div>{MANAGER_SCHEDULE_LABELS.REPEATED_PATTERNS}</div>
              <div>{MANAGER_SCHEDULE_LABELS.REPEATED_WEEKS}</div>
              <div>{MANAGER_SCHEDULE_LABELS.REGISTERED_WEEKS}</div>
              <div>{MANAGER_SCHEDULE_LABELS.REPEAT_RATE}</div>
            </div>
            {mobilityStats.map(item => (
              <div key={item.managerEmail} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,0.7fr) minmax(0,1fr) minmax(0,2fr) minmax(0,0.7fr) minmax(0,0.7fr) minmax(0,0.6fr)', minWidth: 1180, padding: '10px 16px', borderBottom: '1px solid var(--border-primary)', alignItems: 'center', background: 'var(--bg-surface)' }}>
                <div className={styles.className}>
                  {item.managerName}
                  <span className={styles.centreName}>{item.managerEmail}</span>
                </div>
                <div><Badge variant="default" size="sm" shape="rounded">{getManagerRoleText(item.managerEmail)}</Badge></div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.regionText}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                  {item.patterns.map(pattern => (
                    <Badge key={`${pattern.centreName}:${pattern.weekday}:${pattern.session}`} variant="warning" size="sm" shape="rounded">
                      {pattern.centreName} · {getWeekdayLabelByValue(pattern.weekday)} · {getSessionLabel(pattern.session)} · {FORMAT.number(pattern.repeatedWeeks)} tuần
                    </Badge>
                  ))}
                </div>
                <div><Badge variant="warning" size="sm" shape="rounded">{FORMAT.number(item.repeatedWeeks)}</Badge></div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{FORMAT.number(item.registeredWeeks)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 590 }}>{FORMAT.percentage(item.repeatRate * 100)}</div>
              </div>
            ))}
            {mobilityStats.length === 0 && (
              <EmptyState
                icon={<Icon.Building size={32} />}
                title={MANAGER_SCHEDULE_LABELS.LOW_MOBILITY_EMPTY}
                subtitle={MANAGER_SCHEDULE_LABELS.LOW_MOBILITY_DESC}
              />
            )}
          </div>
          </AdminTableSection>
        </div>

        <div className={styles.chartsSection} style={{ marginBottom: 'var(--space-4)' }}>
          <div className={styles.tableHeader}>
            <div className={styles.groupHeader}>
              <Icon.BarChart size={15} />
              {MANAGER_SCHEDULE_LABELS.STATS_SECTION}
            </div>
          </div>
          <div className={styles.chartsGrid}>
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>Theo cơ sở</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData.byCentre} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis dataKey="name" type="category" width={84} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#374151' }} />
                  <ReTooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="total" fill={CHART_COLORS.PRIMARY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>Theo buổi</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData.bySession} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#374151' }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <ReTooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {chartData.bySession.map(item => <Cell key={item.session} fill={SESSION_COLORS[item.session]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>{MANAGER_SCHEDULE_LABELS.MANAGERS_BY_SHIFT_COUNT}</div>
              <ResponsiveContainer width="100%" height={Math.max(220, chartData.byManager.length * 30)}>
                <BarChart data={chartData.byManager} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis dataKey="name" type="category" width={130} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#374151' }} />
                  <ReTooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="total" fill={CHART_COLORS.PALETTE[1]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <AdminTableSection
            title={MANAGER_SCHEDULE_LABELS.CALENDAR_SECTION}
            count={filteredSchedules.length}
            loading={loading}
            isExpanded={tableExpanded}
            onToggle={() => setTableExpanded(value => !value)}
            toolbarSlot={(
              <div className={styles.tableToolbar}>
                <button className={styles.clearCacheBtn} type="button" onClick={() => setCalendarWeekStart(prev => addDays(prev, -7))}>
                  <Icon.ChevronLeft />
                  {MANAGER_SCHEDULE_LABELS.PREVIOUS_WEEK}
                </button>
                <div className={styles.dateControls}>
                  <span className={styles.dateLabel}>{MANAGER_SCHEDULE_LABELS.WEEK_START}</span>
                  <input
                    className={styles.dateInput}
                    type="date"
                    value={calendarWeekStart}
                    onChange={event => setCalendarWeekStart(getWeekStart(event.target.value))}
                  />
                </div>
                <button className={styles.clearCacheBtn} type="button" onClick={() => setCalendarWeekStart(prev => addDays(prev, 7))}>
                  {MANAGER_SCHEDULE_LABELS.NEXT_WEEK}
                  <Icon.ChevronRight />
                </button>
                <div className={`${styles.toolbarGrow} ${styles.managerScheduleSearchWrap}`}>
                  <span className={styles.managerScheduleSearchIcon}>
                    <Icon.Search />
                  </span>
                  <input
                    className={`${styles.dateInput} ${styles.managerScheduleSearchInput}`}
                    placeholder="Tìm quản lý, cơ sở, buổi..."
                    value={tableQuery}
                    onChange={event => setTableQuery(event.target.value)}
                  />
                </div>
              </div>
            )}
          >
            <div className={styles.tableScrollWrapper}>
              <div className={styles.managerScheduleCalendarContent}>
                <div className={styles.managerScheduleWeekTitle}>
                  <Icon.CalendarDays size={14} />
                  <span>
                    Tuần {formatShortDate(calendarWeekStart)} - {formatShortDate(addDays(calendarWeekStart, 6))}
                  </span>
                </div>
                <div className={styles.managerScheduleCalendarGrid}>
                  <div className={styles.managerScheduleHeaderCell}>
                    <span className={styles.managerScheduleEmptySlot}>
                      {MANAGER_SCHEDULE_LABELS.SESSION_COLUMN}
                    </span>
                  </div>
                  {calendarWeekDates.map(date => {
                    const requiredWeekend = isRequiredWeekend(date);
                    return (
                      <div
                        key={date}
                        className={[
                          styles.managerScheduleHeaderCell,
                          requiredWeekend ? styles.managerScheduleHeaderCellRequired : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <div className={[
                          styles.managerScheduleHeaderLabel,
                          requiredWeekend ? styles.managerScheduleHeaderLabelRequired : '',
                        ].filter(Boolean).join(' ')}
                        >
                          {getWeekdayLabel(date)}
                        </div>
                        <div className={styles.managerScheduleHeaderDate}>{formatShortDate(date)}</div>
                      </div>
                    );
                  })}

                  {MANAGER_WORK_SESSIONS.map(sessionItem => (
                    <Fragment key={sessionItem.value}>
                      <div key={`${calendarWeekStart}-${sessionItem.value}-label`} className={styles.managerScheduleSessionCell}>
                        <div className={styles.managerScheduleSessionLabel}>{sessionItem.label}</div>
                        <div className={styles.managerScheduleSessionTime}>{sessionItem.time}</div>
                      </div>
                      {calendarWeekDates.map(date => {
                        const slotItems = schedulesBySlot[`${date}:${sessionItem.value}`] || [];
                        const byCentre = slotItems.reduce<Record<string, ManagerScheduleRegistration[]>>((acc, item) => {
                          const centreKey = item.centreShortName || item.centreName || item.centreId;
                          acc[centreKey] = acc[centreKey] ?? [];
                          acc[centreKey].push(item);
                          return acc;
                        }, {});

                        return (
                          <div
                            key={`${date}:${sessionItem.value}`}
                            className={[
                              styles.managerScheduleSlotCell,
                              isRequiredWeekend(date) ? styles.managerScheduleSlotCellRequired : '',
                            ].filter(Boolean).join(' ')}
                          >
                            {Object.entries(byCentre).length === 0 ? (
                              <span className={styles.managerScheduleEmptySlot}>{MANAGER_SCHEDULE_LABELS.EMPTY_SLOT}</span>
                            ) : (
                              <div className={styles.managerScheduleSlotStack}>
                                {Object.entries(byCentre).map(([centreName, items]) => (
                                  <div key={centreName} className={styles.managerScheduleCentreGroup}>
                                    <div className={styles.managerScheduleCentreHeader}>
                                      <CentreBadge name={centreName} />
                                      <Badge variant="info" size="sm" shape="rounded">{items.length}</Badge>
                                    </div>
                                    <div className={styles.managerScheduleMemberList}>
                                      {items.map(item => (
                                        <div key={item.id} className={styles.managerScheduleMemberRow}>
                                          <span title={getManagerName(item.managerEmail, item.managerName)} className={styles.managerScheduleMemberName}>
                                            {getManagerName(item.managerEmail, item.managerName)}
                                          </span>
                                          <button className={`${styles.tableActionBtn} ${styles.managerScheduleDeleteButton}`} type="button" aria-label="Xoá lịch" onClick={() => handleDelete(item.id)}><Icon.Trash /></button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </AdminTableSection>
        </div>

        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </PageLayout>
    </ProtectedPage>
  );
}

export default function ManagerSchedulesAdminPage() {
  return <ManagerSchedulesAdminPageInner />;
}
