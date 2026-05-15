'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AdminPageWrapper } from '@/components/AdminPageWrapper';
import { ProtectedPage } from '@/components/ProtectedPage';
import {
  AdminTableSection,
  Badge,
  DateRangeInput,
  EmptyState,
  Icon,
  Modal,
  ModalHeader,
  Spinner,
  StatCard,
  TableGroupHeader,
  ViewModeToggle,
} from '@/components/ui';
import { CustomTooltip } from '@/components/ui/ChartComponents';
import { LABELS } from '@/constants';
import { useSharedDateRange } from '@/hooks/useSharedFilterState';
import { getUsageAnalytics } from '@/lib/admin-actions';
import { getAuthToken } from '@/lib/auth/clientAuth';
import styles from '@/app/dashboard.module.css';

type UsageAnalytics = NonNullable<Awaited<ReturnType<typeof getUsageAnalytics>>['data']>;

type TrendMetric = 'daily' | 'weekly' | 'hourly';
type EnvironmentMetric = 'devices' | 'browsers' | 'operatingSystems';
type EnvironmentUserDetail = UsageAnalytics['environmentUserDetails'][EnvironmentMetric][number];
type TrendChartItem = {
  name: string;
  count: number;
  hour?: string;
};
type ChartClickState = {
  activePayload?: Array<{
    payload?: TrendChartItem;
  }>;
};
type UsageTrendDotProps = {
  cx?: number | string;
  cy?: number | string;
  payload?: TrendChartItem;
  isHourly: boolean;
  radius?: number;
  onSelectHour: (hour: string) => void;
};

function UsageTrendDot({ cx, cy, payload, isHourly, radius = 3.5, onSelectHour }: UsageTrendDotProps) {
  if (typeof cx !== 'number' || typeof cy !== 'number') return null;
  const hour = payload?.hour;
  const canSelect = isHourly && Boolean(hour);

  return (
    <g
      role={canSelect ? 'button' : undefined}
      tabIndex={canSelect ? 0 : undefined}
      aria-label={canSelect ? `Xem người dùng hoạt động lúc ${hour}` : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (hour) onSelectHour(hour);
      }}
      onKeyDown={(event) => {
        if (!hour || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onSelectHour(hour);
      }}
      style={{ cursor: canSelect ? 'pointer' : 'default', outline: 'none' }}
    >
      <circle cx={cx} cy={cy} r={12} fill="transparent" pointerEvents="all" />
      <circle cx={cx} cy={cy} r={radius} fill="var(--brand-indigo)" stroke="var(--bg-primary)" strokeWidth={radius > 4 ? 2 : 0} pointerEvents="none" />
    </g>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PIE_COLORS = [
  'var(--brand-indigo)',
  'var(--status-success)',
  'var(--status-warning)',
  'var(--status-info)',
  'var(--text-tertiary)',
];

function ChartCard({
  title,
  actionSlot,
  children,
}: {
  title: string;
  actionSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.tableSection}>
      <TableGroupHeader title={title} icon={<Icon.BarChart />} actionSlot={actionSlot} />
      {children}
    </div>
  );
}

function ViewTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <ViewModeToggle value={value} options={options} onChange={onChange} />
  );
}

function compactDistributionItems(items: Array<{ name: string; count: number }>, limit = 4) {
  if (items.length <= limit) return items;
  const visible = items.slice(0, limit);
  const otherCount = items.slice(limit).reduce((sum, item) => sum + item.count, 0);
  return otherCount > 0 ? [...visible, { name: 'Khác', count: otherCount }] : visible;
}

function TopPagesChart({ items }: { items: Array<{ name: string; count: number; uniqueUsers: number }> }) {
  return (
    <ChartCard title="Trang sử dụng nhiều nhất">
      <div style={{ padding: 'var(--space-4)', height: Math.max(260, items.length * 34) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 8 }}>
            <CartesianGrid stroke="rgba(0,0,0,0.06)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-quaternary)' }} axisLine={false} tickLine={false} />
            <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
            <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Bar dataKey="count" name="Lượt xem" fill="var(--brand-indigo)" radius={[0, 5, 5, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function UsageTrendChart({
  items,
  metric,
  onMetricChange,
  onSelectHour,
}: {
  items: TrendChartItem[];
  metric: TrendMetric;
  onMetricChange: (value: TrendMetric) => void;
  onSelectHour: (hour: string) => void;
}) {
  const isHourly = metric === 'hourly';
  const label = metric === 'daily'
    ? 'Lượt xem theo ngày'
    : metric === 'weekly'
      ? 'Lượt xem theo tuần'
      : 'Lượt xem theo giờ';
  const handleChartClick = (state: ChartClickState | null) => {
    if (!isHourly) return;
    const hour = state?.activePayload?.[0]?.payload?.hour;
    if (hour) onSelectHour(hour);
  };

  return (
    <ChartCard title="Xu hướng lượt xem">
      <div style={{ padding: 'var(--space-4) var(--space-4) 0' }}>
        <ViewTabs
          value={metric}
          onChange={onMetricChange}
          options={[
            { value: 'hourly', label: 'Theo giờ' },
            { value: 'daily', label: 'Theo ngày' },
            { value: 'weekly', label: 'Theo tuần' },
          ]}
        />
      </div>
      <div style={{ padding: 'var(--space-4)', height: 280, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={items}
            margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
            onClick={(state) => handleChartClick(state as ChartClickState | null)}
            style={{ cursor: isHourly ? 'pointer' : 'default' }}
          >
            <defs>
              <linearGradient id="usageTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--brand-indigo)" stopOpacity={isHourly ? 0.10 : 0.16} />
                <stop offset="95%" stopColor="var(--brand-indigo)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-quaternary)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-quaternary)' }} axisLine={false} tickLine={false} width={36} />
            <ReTooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Area
              type="monotone"
              dataKey="count"
              name={label}
              stroke="var(--brand-indigo)"
              strokeWidth={2}
              fill="url(#usageTrendFill)"
              dot={(props: unknown) => (
                <UsageTrendDot
                  {...(props as Omit<UsageTrendDotProps, 'isHourly' | 'radius' | 'onSelectHour'>)}
                  isHourly={isHourly}
                  onSelectHour={onSelectHour}
                />
              )}
              activeDot={(props: unknown) => (
                <UsageTrendDot
                  {...(props as Omit<UsageTrendDotProps, 'isHourly' | 'radius' | 'onSelectHour'>)}
                  isHourly={isHourly}
                  radius={6}
                  onSelectHour={onSelectHour}
                />
              )}
            />
          </AreaChart>
        </ResponsiveContainer>
        {isHourly && items.length > 0 && (
          <div
            aria-hidden={false}
            style={{
              position: 'absolute',
              inset: 'var(--space-4)',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            {items.map((item, index) => {
              const hour = item.hour;
              if (!hour) return null;
              const left = items.length === 1 ? 50 : (index / (items.length - 1)) * 100;

              return (
                <button
                  key={hour}
                  type="button"
                  aria-label={`Xem người dùng hoạt động lúc ${hour}`}
                  title={`Xem người dùng hoạt động lúc ${hour}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectHour(hour);
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${left}%`,
                    width: 28,
                    transform: 'translateX(-50%)',
                    border: 0,
                    padding: 0,
                    margin: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </ChartCard>
  );
}

function RetentionChart({
  items,
  metric,
  onMetricChange,
}: {
  items: Array<{ name: string; count: number }>;
  metric: TrendMetric;
  onMetricChange: (value: TrendMetric) => void;
}) {
  const label = metric === 'daily' ? 'Người dùng hoạt động theo ngày' : 'Người dùng hoạt động theo tuần';

  return (
    <ChartCard title="Mức độ quay lại của người dùng">
      <div style={{ padding: 'var(--space-4) var(--space-4) 0' }}>
        <ViewTabs
          value={metric}
          onChange={onMetricChange}
          options={[
            { value: 'daily', label: 'Theo ngày' },
            { value: 'weekly', label: 'Theo tuần' },
          ]}
        />
      </div>
      <div style={{ padding: 'var(--space-4)', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={items} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="retentionFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--status-success)" stopOpacity={0.16} />
                <stop offset="95%" stopColor="var(--status-success)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-quaternary)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-quaternary)' }} axisLine={false} tickLine={false} width={36} />
            <ReTooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Area
              type="monotone"
              dataKey="count"
              name={label}
              stroke="var(--status-success)"
              strokeWidth={2}
              fill="url(#retentionFill)"
              dot={{ r: 3, fill: 'var(--status-success)', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function EnvironmentChartPanel({
  items,
  value,
  onChange,
  onSelectGroup,
}: {
  items: Array<{ name: string; count: number }>;
  value: EnvironmentMetric;
  onChange: (value: EnvironmentMetric) => void;
  onSelectGroup: (name: string) => void;
}) {
  const compactItems = compactDistributionItems(items);
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <ChartCard title="Môi trường sử dụng">
      <div style={{ padding: 'var(--space-4) var(--space-4) 0' }}>
        <ViewTabs
          value={value}
          onChange={onChange}
          options={[
            { value: 'devices', label: 'Thiết bị' },
            { value: 'browsers', label: 'Trình duyệt' },
            { value: 'operatingSystems', label: 'Hệ điều hành' },
          ]}
        />
      </div>
      <div className={styles.usageEnvironmentBody}>
        <div className={styles.usageEnvironmentChart}>
          <div style={{ height: 132 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={compactItems} dataKey="count" nameKey="name" innerRadius={36} outerRadius={58} paddingAngle={2}>
                  {compactItems.map((item, index) => (
                    <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                  <Label
                    value={formatNumber(total)}
                    position="center"
                    style={{ fill: 'var(--text-primary)', fontSize: 14, fontWeight: 590 }}
                  />
                </Pie>
                <ReTooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {compactItems.map((item, index) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: PIE_COLORS[index % PIE_COLORS.length], flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                <span style={{ color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                  {formatNumber(total ? (item.count / total) * 100 : 0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.tableScrollWrapper}>
          <table className={styles.studentTable}>
            <thead>
              <tr>
                <th>Nhóm</th>
                <th style={{ width: 140 }}>Lượt xem</th>
                <th style={{ width: 160 }}>Tỷ trọng</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.name} style={{ cursor: 'pointer' }} onClick={() => onSelectGroup(item.name)}>
                  <td style={{ fontWeight: 510 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 99, background: PIE_COLORS[index % PIE_COLORS.length], flexShrink: 0 }} />
                      {item.name}
                    </span>
                  </td>
                  <td>{formatNumber(item.count)}</td>
                  <td>{formatNumber(total ? (item.count / total) * 100 : 0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ChartCard>
  );
}

function OnlineUsersPanel({
  users,
  onSelectUser,
}: {
  users: Array<{ email: string; lastSeenAt: string; page: string; device: string }>;
  onSelectUser: (email: string) => void;
}) {
  return (
    <div className={styles.tableSection}>
      <div className={styles.tableHeader}>
        <div className={styles.groupHeader}>
          <Icon.Users />
          Người dùng đang trực tuyến
        </div>
        <Badge variant="passed" size="sm" shape="rounded">{formatNumber(users.length)} đang hoạt động</Badge>
      </div>
      {users.length > 0 ? (
        <div className={styles.tableScrollWrapper}>
          <table className={styles.studentTable}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Trang hiện tại</th>
                <th style={{ width: 140 }}>Thiết bị</th>
                <th style={{ width: 180 }}>Cập nhật gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.email} style={{ cursor: 'pointer' }} onClick={() => onSelectUser(user.email)}>
                  <td style={{ fontWeight: 510 }}>{user.email}</td>
                  <td>{user.page}</td>
                  <td>{user.device}</td>
                  <td>{formatDateTime(user.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={<Icon.Users size={28} />}
          title="Chưa có người dùng trực tuyến"
          subtitle="Danh sách này tính theo hoạt động trong 10 phút gần nhất"
        />
      )}
    </div>
  );
}

export default function UsageAnalyticsPage() {
  const [fromDate, toDate, setFromDate, setToDate, datesLoaded] = useSharedDateRange();
  const initialLoadRef = useRef(false);
  const [data, setData] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState({
    userPages: true,
  });
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [selectedEnvironmentGroup, setSelectedEnvironmentGroup] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('hourly');
  const [retentionMetric, setRetentionMetric] = useState<TrendMetric>('daily');
  const [environmentMetric, setEnvironmentMetric] = useState<EnvironmentMetric>('devices');

  const loadData = useCallback(async () => {
    if (!fromDate || !toDate) {
      setError('Vui lòng chọn khoảng thời gian');
      setLoading(false);
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      setError('Ngày bắt đầu phải trước ngày kết thúc');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const result = await getUsageAnalytics(token, { fromDate, toDate });

      if (result.success) {
        setData(result.data);
      } else {
        setData(null);
        setError(result.error || 'Không thể tải dữ liệu sử dụng');
      }
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu sử dụng');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!datesLoaded || initialLoadRef.current) return;
    initialLoadRef.current = true;

    const timer = window.setTimeout(() => {
      loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [datesLoaded, loadData]);

  const summaryCards = useMemo(() => {
    if (!data) return [];

    return [
      {
        label: 'Người dùng hoạt động',
        value: formatNumber(data.summary.activeUsers),
        desc: `Trong ${data.rangeDays} ngày đã chọn`,
      },
      {
        label: 'Đang trực tuyến',
        value: formatNumber(data.summary.onlineUsers),
        desc: 'Có hoạt động trong 10 phút gần nhất',
      },
      {
        label: 'Tổng lượt xem trang',
        value: formatNumber(data.summary.totalPageViews),
        desc: `${formatNumber(data.summary.avgPageViewsPerUser)} lượt / người dùng`,
      },
      {
        label: 'Lượt xem trung bình',
        value: formatNumber(data.summary.avgPageViewsPerUser),
        desc: 'Lượt xem / người dùng',
      },
      {
        label: 'Trang có sử dụng',
        value: formatNumber(data.summary.activePages),
        desc: 'Số trang được truy cập',
      },
      {
        label: 'Giờ cao điểm',
        value: data.summary.busiestHour,
        desc: `Cập nhật cuối: ${formatDateTime(data.lastActivityAt)}`,
      },
    ];
  }, [data]);

  const selectedUserPages = useMemo(() => {
    if (!data || !selectedUserEmail) return [];
    return data.userPageDetails.filter(row => row.email === selectedUserEmail);
  }, [data, selectedUserEmail]);

  const selectedUserSummary = useMemo(() => {
    if (!data || !selectedUserEmail) return null;
    const summary = data.userSummaries.find(user => user.email === selectedUserEmail);
    if (summary) return summary;

    const onlineUser = data.onlineUsers.find(user => user.email === selectedUserEmail);
    if (!onlineUser) return null;

    return {
      email: onlineUser.email,
      uniquePages: 0,
      totalPageViews: 0,
      totalEvents: 0,
      lastActivityAt: onlineUser.lastSeenAt,
      topPage: onlineUser.page,
    };
  }, [data, selectedUserEmail]);

  const dailyChartItems = useMemo(() => (
    data?.dailyTrend.map(item => ({
      name: new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      count: item.count,
    })) || []
  ), [data]);

  const weeklyChartItems = useMemo(() => (
    data?.weeklyTrend.map(item => ({
      name: `Tuần ${new Date(item.weekStart).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`,
      count: item.count,
    })) || []
  ), [data]);

  const hourlyChartItems = useMemo(() => (
    data?.hourlyDistribution.map(item => ({
      name: item.hour,
      hour: item.hour,
      count: item.count,
    })) || []
  ), [data]);

  const trendChartItems = trendMetric === 'daily'
    ? dailyChartItems
    : trendMetric === 'weekly'
      ? weeklyChartItems
      : hourlyChartItems;

  const dailyRetentionItems = useMemo(() => (
    data?.dailyActiveTrend.map(item => ({
      name: new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      count: item.count,
    })) || []
  ), [data]);

  const weeklyRetentionItems = useMemo(() => (
    data?.weeklyActiveTrend.map(item => ({
      name: `Tuần ${new Date(item.weekStart).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`,
      count: item.count,
    })) || []
  ), [data]);

  const retentionChartItems = retentionMetric === 'daily' ? dailyRetentionItems : weeklyRetentionItems;

  const environmentItems = useMemo(() => {
    if (!data) return [];
    if (environmentMetric === 'devices') return data.devices;
    if (environmentMetric === 'browsers') return data.browsers;
    return data.operatingSystems;
  }, [data, environmentMetric]);

  const environmentLabel = environmentMetric === 'devices'
    ? 'Thiết bị'
    : environmentMetric === 'browsers'
      ? 'Trình duyệt'
      : 'Hệ điều hành';

  const selectedEnvironmentUsers: EnvironmentUserDetail[] = useMemo(() => {
    if (!data || !selectedEnvironmentGroup) return [];
    return data.environmentUserDetails[environmentMetric].filter(row => row.name === selectedEnvironmentGroup);
  }, [data, environmentMetric, selectedEnvironmentGroup]);

  const selectedHourUsers = useMemo(() => {
    if (!data || !selectedHour) return [];
    const rows = data.hourlyUserDetails.filter(row => row.hour === selectedHour);
    const users = new Map<string, {
      email: string;
      totalEvents: number;
      totalPageViews: number;
      lastActivityAt: string | null;
      pages: Array<{ page: string; pageViews: number }>;
    }>();

    rows.forEach(row => {
      const current = users.get(row.email) || {
        email: row.email,
        totalEvents: row.totalEvents,
        totalPageViews: 0,
        lastActivityAt: row.lastActivityAt,
        pages: [],
      };

      current.totalEvents = Math.max(current.totalEvents, row.totalEvents);
      current.totalPageViews += row.pageViews;
      if (!current.lastActivityAt || (row.lastActivityAt && row.lastActivityAt > current.lastActivityAt)) {
        current.lastActivityAt = row.lastActivityAt;
      }
      current.pages.push({ page: row.page, pageViews: row.pageViews });
      users.set(row.email, current);
    });

    return Array.from(users.values())
      .map(user => ({
        ...user,
        pages: user.pages.sort((a, b) => b.pageViews - a.pageViews || a.page.localeCompare(b.page, 'vi-VN')),
      }))
      .sort((a, b) => b.totalPageViews - a.totalPageViews || b.totalEvents - a.totalEvents || a.email.localeCompare(b.email, 'vi-VN'));
  }, [data, selectedHour]);

  const selectedHourTotalPageViews = selectedHourUsers.reduce((sum, user) => sum + user.totalPageViews, 0);
  const selectedHourTotalEvents = selectedHourUsers.reduce((sum, user) => sum + user.totalEvents, 0);

  return (
    <ProtectedPage pageKey="admin-users">
      <AdminPageWrapper title="Phân tích sử dụng" activePage="admin-usage-analytics">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className={styles.toolbar} style={{ marginBottom: 0 }}>
            <div className={styles.toolbarRow}>
              <DateRangeInput
                dateFrom={fromDate}
                dateTo={toDate}
                onDateFromChange={setFromDate}
                onDateToChange={setToDate}
                label={LABELS.TIME}
              />

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                {loading && <Spinner size={14} />}
                <button className={styles.primaryBtn} onClick={() => loadData()} disabled={loading}>
                  <Icon.Refresh />
                  Tải dữ liệu
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className={styles.errorBanner}>
              {error}
            </div>
          )}

          {loading && !data ? (
            <EmptyState icon={<Spinner size={32} />} title="Đang tải dữ liệu sử dụng" subtitle="Đang tổng hợp lượt xem, trang, người dùng và thiết bị" />
          ) : data && (data.summary.totalEvents > 0 || data.summary.onlineUsers > 0) ? (
            <>
            <div className={styles.statsGrid}>
              {summaryCards.map((card, index) => (
                <StatCard key={card.label} {...card} delay={index * 0.03} />
              ))}
            </div>

            <UsageTrendChart
              items={trendChartItems}
              metric={trendMetric}
              onMetricChange={setTrendMetric}
              onSelectHour={setSelectedHour}
            />

            <RetentionChart
              items={retentionChartItems}
              metric={retentionMetric}
              onMetricChange={setRetentionMetric}
            />

            <TopPagesChart items={data.topPages} />

            <AdminTableSection
              title="Người dùng sử dụng nhiều nhất"
              count={data.userSummaries.length}
              isExpanded={expanded.userPages}
              onToggle={() => setExpanded(prev => ({ ...prev, userPages: !prev.userPages }))}
            >
              <div className={styles.tableScrollWrapper}>
                <table className={styles.studentTable}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th style={{ width: 140 }}>Trang riêng</th>
                      <th style={{ width: 140 }}>Lượt xem</th>
                      <th style={{ width: 140 }}>Tổng hoạt động</th>
                      <th>Trang dùng nhiều nhất</th>
                      <th style={{ width: 180 }}>Hoạt động lần cuối</th>
                      <th style={{ width: 120 }}>Mức độ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.userSummaries.map(user => (
                      <tr key={user.email} style={{ cursor: 'pointer' }} onClick={() => setSelectedUserEmail(user.email)}>
                        <td style={{ fontWeight: 510 }}>{user.email}</td>
                        <td>{formatNumber(user.uniquePages)}</td>
                        <td>{formatNumber(user.totalPageViews)}</td>
                        <td>{formatNumber(user.totalEvents)}</td>
                        <td>{user.topPage}</td>
                        <td>{formatDateTime(user.lastActivityAt)}</td>
                        <td>
                          <Badge variant={user.totalPageViews >= data.summary.avgPageViewsPerUser ? 'passed' : 'default'} size="sm" shape="rounded">
                            {user.totalPageViews >= data.summary.avgPageViewsPerUser ? 'Cao' : 'Ổn định'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminTableSection>

            <OnlineUsersPanel users={data.onlineUsers} onSelectUser={setSelectedUserEmail} />

            <EnvironmentChartPanel
              items={environmentItems}
              value={environmentMetric}
              onChange={(value) => {
                setEnvironmentMetric(value);
                setSelectedEnvironmentGroup(null);
              }}
              onSelectGroup={setSelectedEnvironmentGroup}
            />
            </>
          ) : (
            <EmptyState
              icon={<Icon.BarChart size={32} />}
              title="Chưa có dữ liệu sử dụng"
              subtitle="Dữ liệu sẽ xuất hiện sau khi người dùng mở app và hệ thống ghi nhận lượt xem trang hoặc nhịp hoạt động"
            />
          )}
        </div>

        {selectedUserEmail && selectedUserSummary && (
          <Modal open={true} onClose={() => setSelectedUserEmail(null)} maxWidth="min(920px, calc(100vw - 40px))">
            <ModalHeader
              title="Chi tiết sử dụng theo người dùng"
              subtitle={selectedUserEmail}
              onClose={() => setSelectedUserEmail(null)}
            />
            <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxHeight: 'calc(90vh - 96px)', overflowY: 'auto' }}>
              <div className={styles.statsGrid} style={{ marginBottom: 0 }}>
                <StatCard label="Trang riêng" value={formatNumber(selectedUserSummary.uniquePages)} desc="Số trang đã truy cập" />
                <StatCard label="Lượt xem trang" value={formatNumber(selectedUserSummary.totalPageViews)} desc="Tổng lượt xem" />
                <StatCard label="Tổng hoạt động" value={formatNumber(selectedUserSummary.totalEvents)} desc="Bao gồm lượt xem và nhịp hoạt động" />
              </div>

              <div className={styles.tableScrollWrapper}>
                <table className={styles.studentTable}>
                  <thead>
                    <tr>
                      <th>Trang</th>
                      <th style={{ width: 140 }}>Lượt xem</th>
                      <th style={{ width: 240 }}>Tỷ trọng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUserPages.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ color: 'var(--text-tertiary)', textAlign: 'center' }}>
                          Chưa có lượt xem trang trong phạm vi thời gian đang chọn
                        </td>
                      </tr>
                    ) : selectedUserPages.map(row => (
                      <tr key={`${row.email}-${row.page}`}>
                        <td style={{ fontWeight: 510 }}>{row.page}</td>
                        <td>{formatNumber(row.views)}</td>
                        <td>
                          <div style={{ height: 7, borderRadius: 999, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.max((row.views / Math.max(selectedUserSummary.totalPageViews, 1)) * 100, 4)}%`,
                                height: '100%',
                                background: 'var(--brand-indigo)',
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Modal>
        )}

        {selectedEnvironmentGroup && (
          <Modal open={true} onClose={() => setSelectedEnvironmentGroup(null)} maxWidth="min(860px, calc(100vw - 40px))">
            <ModalHeader
              title={`Người dùng theo ${environmentLabel}`}
              subtitle={selectedEnvironmentGroup}
              onClose={() => setSelectedEnvironmentGroup(null)}
            />
            <div style={{ padding: 'var(--space-5)', maxHeight: 'calc(90vh - 96px)', overflowY: 'auto' }}>
              <div className={styles.tableScrollWrapper}>
                <table className={styles.studentTable}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th style={{ width: 140 }}>Lượt xem</th>
                      <th style={{ width: 160 }}>Tổng hoạt động</th>
                      <th style={{ width: 180 }}>Hoạt động lần cuối</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEnvironmentUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ color: 'var(--text-tertiary)', textAlign: 'center' }}>
                          Chưa có người dùng trong nhóm này
                        </td>
                      </tr>
                    ) : selectedEnvironmentUsers.map(user => (
                      <tr key={`${selectedEnvironmentGroup}-${user.email}`} style={{ cursor: 'pointer' }} onClick={() => setSelectedUserEmail(user.email)}>
                        <td style={{ fontWeight: 510 }}>{user.email}</td>
                        <td>{formatNumber(user.pageViews)}</td>
                        <td>{formatNumber(user.totalEvents)}</td>
                        <td>{formatDateTime(user.lastActivityAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Modal>
        )}

        {selectedHour && (
          <Modal open={true} onClose={() => setSelectedHour(null)} maxWidth="min(980px, calc(100vw - 40px))">
            <ModalHeader
              title="Người dùng hoạt động theo khung giờ"
              subtitle={`${selectedHour} trong khoảng ngày đang chọn`}
              onClose={() => setSelectedHour(null)}
            />
            <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxHeight: 'calc(90vh - 96px)', overflowY: 'auto' }}>
              <div className={styles.statsGrid} style={{ marginBottom: 0 }}>
                <StatCard label="Người dùng" value={formatNumber(selectedHourUsers.length)} desc="Có hoạt động trong khung giờ" />
                <StatCard label="Lượt xem trang" value={formatNumber(selectedHourTotalPageViews)} desc="Tổng page view của khung giờ" />
                <StatCard label="Tổng hoạt động" value={formatNumber(selectedHourTotalEvents)} desc="Bao gồm page view và heartbeat" />
              </div>

              <div className={styles.tableScrollWrapper}>
                <table className={styles.studentTable}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Trang đã truy cập</th>
                      <th style={{ width: 140 }}>Lượt xem</th>
                      <th style={{ width: 140 }}>Tổng hoạt động</th>
                      <th style={{ width: 180 }}>Hoạt động cuối</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedHourUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ color: 'var(--text-tertiary)', textAlign: 'center' }}>
                          Chưa có người dùng hoạt động trong khung giờ này
                        </td>
                      </tr>
                    ) : selectedHourUsers.map(user => (
                      <tr key={`${selectedHour}-${user.email}`} style={{ cursor: 'pointer' }} onClick={() => setSelectedUserEmail(user.email)}>
                        <td style={{ fontWeight: 510 }}>{user.email}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                            {user.pages.map(page => (
                              <Badge key={`${user.email}-${page.page}`} variant={page.pageViews > 0 ? 'default' : 'exempt'} size="sm" shape="rounded">
                                {page.pageViews > 0 ? `${page.page} (${formatNumber(page.pageViews)})` : page.page}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td>{formatNumber(user.totalPageViews)}</td>
                        <td>{formatNumber(user.totalEvents)}</td>
                        <td>{formatDateTime(user.lastActivityAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Modal>
        )}
      </AdminPageWrapper>
    </ProtectedPage>
  );
}
