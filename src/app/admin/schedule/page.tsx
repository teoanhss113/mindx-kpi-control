'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { PageLayout } from '@/components/PageLayout';
import { Badge, CentreBadge, CentreSelect, Icon, ToastContainer, useToast } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import { getCache, setCache } from '@/lib/idb';
import { supabase } from '@/lib/supabase/client';
import { fetchAllCentres, type Centre } from '@/services/centresService';
import {
  createManagerSchedules,
  deleteManagerSchedule,
  fetchManagerSchedules,
} from '@/services/managerScheduleService';
import {
  CACHE_KEYS,
  MANAGER_REQUIRED_WEEKDAYS,
  MANAGER_SCHEDULE_LABELS,
  MANAGER_WORK_SESSIONS,
  MESSAGES,
  WEEKDAY_OPTIONS,
} from '@/constants';
import type { ManagerScheduleInput, ManagerScheduleRegistration, ManagerWorkSession } from '@/types/managerSchedule';
import styles from '@/app/dashboard.module.css';

const OTHER_CENTRE_OPTION_ID = '__manager_schedule_other__';
const OTHER_CENTRE_ID_PREFIX = 'other:';

function toDateInputValue(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getMonday(date = new Date()) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day));
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function formatShortDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-');
  return `${day}/${month}/${year}`;
}

function slotKey(date: string, session: ManagerWorkSession) {
  return `${date}:${session}`;
}

function isOtherCentreId(centreId: string) {
  return centreId === OTHER_CENTRE_OPTION_ID || centreId.startsWith(OTHER_CENTRE_ID_PREFIX);
}

function makeOtherCentreId(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `${OTHER_CENTRE_ID_PREFIX}${normalized || 'custom'}`;
}

function isRequiredWeekend(weekday: number) {
  return MANAGER_REQUIRED_WEEKDAYS.includes(weekday as typeof MANAGER_REQUIRED_WEEKDAYS[number]);
}

function looksLikeEmail(value: string) {
  return value.includes('@');
}

function displayManagerName(item: ManagerScheduleRegistration, managerNamesByEmail: Record<string, string>) {
  const emailKey = item.managerEmail.toLowerCase();
  const enrichedName = managerNamesByEmail[emailKey]?.trim();
  const storedName = item.managerName?.trim() || '';
  if (enrichedName && !looksLikeEmail(enrichedName)) return enrichedName;
  if (storedName && !looksLikeEmail(storedName)) return storedName;
  return item.managerEmail.split('@')[0] || item.managerEmail;
}

async function loadRegionCentreIds() {
  const { data: regionsData, error: regionsError } = await supabase
    .from('regions')
    .select('id')
    .eq('is_active', true);

  if (regionsError || !regionsData?.length) return new Set<string>();

  const { data: regionCentresData, error: regionCentresError } = await supabase
    .from('region_centres')
    .select('centre_id')
    .in('region_id', regionsData.map(region => region.id));

  if (regionCentresError || !regionCentresData?.length) return new Set<string>();
  return new Set(regionCentresData.map(item => item.centre_id).filter(Boolean));
}

async function loadCentresData() {
  const cached = await getCache(CACHE_KEYS.CENTRES);
  const centreData = cached?.centres?.length
    ? cached.centres as Centre[]
    : await fetchAllCentres();

  if (!cached?.centres?.length) {
    await setCache(CACHE_KEYS.CENTRES, { centres: centreData });
  }

  const regionCentreIds = await loadRegionCentreIds();
  return centreData.filter(centre => regionCentreIds.has(centre.id));
}

export default function ManagerScheduleRegistrationPage() {
  const { session } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [weekStart, setWeekStart] = useState(() => toDateInputValue(getMonday()));
  const [centres, setCentres] = useState<Centre[]>([]);
  const [schedules, setSchedules] = useState<ManagerScheduleRegistration[]>([]);
  const [managerNamesByEmail, setManagerNamesByEmail] = useState<Record<string, string>>({});
  const [slotCentres, setSlotCentres] = useState<Record<string, string>>({});
  const [customCentreNames, setCustomCentreNames] = useState<Record<string, string>>({});
  const [slotNotes, setSlotNotes] = useState<Record<string, string>>({});
  const [savingSlots, setSavingSlots] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const otherCentreOption = useMemo<SelectOption>(() => ({
    value: OTHER_CENTRE_OPTION_ID,
    label: MANAGER_SCHEDULE_LABELS.OTHER_CENTRE_LABEL,
    searchTerms: [MANAGER_SCHEDULE_LABELS.OTHER_CENTRE_LABEL],
  }), []);

  const weekDays = useMemo(() => WEEKDAY_OPTIONS.map(day => ({
    ...day,
    date: addDays(weekStart, day.value === 0 ? 6 : day.value - 1),
  })), [weekStart]);

  const dateFrom = weekDays[0]?.date || weekStart;
  const dateTo = weekDays[weekDays.length - 1]?.date || weekStart;
  const myEmail = session?.email?.toLowerCase() || '';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const centreData = await loadCentresData();
      setCentres(centreData);

      const scheduleData = await fetchManagerSchedules({ dateFrom, dateTo });
      setSchedules(scheduleData);
      const uniqueEmails = Array.from(new Set(scheduleData.map(item => item.managerEmail.toLowerCase()).filter(Boolean)));
      if (uniqueEmails.length > 0) {
        const { enrichProfiles } = await import('@/services/userEnrichmentService');
        const enriched = await enrichProfiles(uniqueEmails.map(email => ({
          id: email,
          email,
          role: 'manager' as const,
          is_active: true,
          created_at: '',
        })));

        setManagerNamesByEmail(enriched.reduce<Record<string, string>>((acc, user) => {
          const name = user.full_name || user.username || '';
          if (name) acc[user.email.toLowerCase()] = name;
          return acc;
        }, {}));
      } else {
        setManagerNamesByEmail({});
      }
      const mine = scheduleData
        .filter(item => item.managerEmail.toLowerCase() === myEmail)
        .reduce<Record<string, string>>((acc, item) => {
          acc[slotKey(item.date, item.session)] = isOtherCentreId(item.centreId) ? OTHER_CENTRE_OPTION_ID : item.centreId;
          return acc;
        }, {});
      setSlotCentres(mine);
      setSlotNotes(scheduleData
        .filter(item => item.managerEmail.toLowerCase() === myEmail)
        .reduce<Record<string, string>>((acc, item) => {
          acc[slotKey(item.date, item.session)] = item.note || '';
          return acc;
        }, {}));
      setCustomCentreNames(scheduleData
        .filter(item => item.managerEmail.toLowerCase() === myEmail && isOtherCentreId(item.centreId))
        .reduce<Record<string, string>>((acc, item) => {
          acc[slotKey(item.date, item.session)] = item.centreName || item.centreShortName || '';
          return acc;
        }, {}));
    } catch (error) {
      console.error('Failed to load manager schedules:', error);
      addToast(MESSAGES.ERROR.GENERIC, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, dateFrom, dateTo, myEmail]);

  useEffect(() => {
    if (!session?.email) return;
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [session?.email, loadData]);

  const schedulesBySlot = useMemo(() => {
    return schedules.reduce<Record<string, ManagerScheduleRegistration[]>>((acc, item) => {
      const key = slotKey(item.date, item.session);
      acc[key] = acc[key] ?? [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [schedules]);

  const saveSlot = async (date: string, sessionValue: ManagerWorkSession, centreId: string, customCentreName = '', note = '', forceSave = false) => {
    const key = slotKey(date, sessionValue);
    const previousCentreId = slotCentres[key] || '';
    const previousSchedules = schedules;
    const ownRegistration = schedulesBySlot[key]?.find(item => item.managerEmail.toLowerCase() === myEmail);
    const previousCustomCentreNames = customCentreNames;
    const previousSlotNotes = slotNotes;
    const isOtherSelection = centreId === OTHER_CENTRE_OPTION_ID;
    const finalCustomName = customCentreName.trim();
    const finalNote = note.trim();
    const finalCentreId = isOtherSelection ? makeOtherCentreId(finalCustomName) : centreId;
    const currentStoredCentreId = ownRegistration
      ? (isOtherCentreId(ownRegistration.centreId) ? OTHER_CENTRE_OPTION_ID : ownRegistration.centreId)
      : '';
    const currentStoredCustomName = ownRegistration && isOtherCentreId(ownRegistration.centreId)
      ? (ownRegistration.centreName || ownRegistration.centreShortName || '')
      : '';
    const currentStoredNote = ownRegistration?.note || '';

    if (previousCentreId === centreId && !isOtherSelection && !forceSave) return;
    if (isOtherSelection && !finalCustomName) return;
    if (
      forceSave
      && currentStoredCentreId === centreId
      && currentStoredNote === finalNote
      && (!isOtherSelection || currentStoredCustomName === finalCustomName)
    ) {
      return;
    }

    setSlotCentres(prev => {
      const next = { ...prev };
      if (centreId) next[key] = centreId;
      else delete next[key];
      return next;
    });
    setSavingSlots(prev => ({ ...prev, [key]: true }));

    try {
      if (!centreId) {
        if (ownRegistration) {
          await deleteManagerSchedule(ownRegistration.id);
          setSchedules(prev => prev.filter(item => item.id !== ownRegistration.id));
          setSlotNotes(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          addToast(MANAGER_SCHEDULE_LABELS.DELETE_SUCCESS, 'success');
        }
        return;
      }

      const item: ManagerScheduleInput = (() => {
        const centre = centres.find(item => item.id === centreId);
        const centreName = isOtherSelection ? finalCustomName : centre?.name || '';
        const centreShortName = isOtherSelection ? finalCustomName : centre?.shortName || centre?.name || '';
        return {
          centreId: finalCentreId,
          centreName,
          centreShortName,
          date,
          weekday: new Date(`${date}T00:00:00`).getDay(),
          session: sessionValue,
          note: finalNote,
        };
      })();

      const currentManagerName = session?.displayName && !looksLikeEmail(session.displayName)
        ? session.displayName
        : session?.email?.split('@')[0] || '';
      const savedRows = await createManagerSchedules([item], currentManagerName);
      if (savedRows[0]) {
        setSchedules(prev => [
          ...prev.filter(item => !(item.managerEmail.toLowerCase() === myEmail && item.date === date && item.session === sessionValue)),
          savedRows[0],
        ]);
        addToast(MANAGER_SCHEDULE_LABELS.SAVE_SUCCESS, 'success');
      }
    } catch (error) {
      console.error('Failed to save manager schedules:', error);
      setSchedules(previousSchedules);
      setCustomCentreNames(previousCustomCentreNames);
      setSlotNotes(previousSlotNotes);
      setSlotCentres(prev => {
        const next = { ...prev };
        if (previousCentreId) next[key] = previousCentreId;
        else delete next[key];
        return next;
      });
      addToast(error instanceof Error ? error.message : MESSAGES.ERROR.GENERIC, 'error');
    } finally {
      setSavingSlots(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleCentreChange = async (date: string, sessionValue: ManagerWorkSession, ids: string[]) => {
    const key = slotKey(date, sessionValue);
    const centreId = ids[ids.length - 1] || '';
    if (centreId === OTHER_CENTRE_OPTION_ID) {
      setSlotCentres(prev => ({ ...prev, [key]: OTHER_CENTRE_OPTION_ID }));
      setCustomCentreNames(prev => ({ ...prev, [key]: prev[key] || '' }));
      return;
    }
    if (centreId !== OTHER_CENTRE_OPTION_ID) {
      setCustomCentreNames(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    if (!centreId) {
      setSlotNotes(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    await saveSlot(date, sessionValue, centreId, '', slotNotes[key] || '');
  };

  const handleCustomCentreSave = async (date: string, sessionValue: ManagerWorkSession) => {
    const key = slotKey(date, sessionValue);
    await saveSlot(date, sessionValue, OTHER_CENTRE_OPTION_ID, customCentreNames[key] || '', slotNotes[key] || '', true);
  };

  const handleSlotNoteSave = async (date: string, sessionValue: ManagerWorkSession) => {
    const key = slotKey(date, sessionValue);
    const centreId = slotCentres[key] || '';
    if (!centreId) return;
    await saveSlot(date, sessionValue, centreId, customCentreNames[key] || '', slotNotes[key] || '', true);
  };

  const moveWeek = (days: number) => {
    setWeekStart(addDays(weekStart, days));
  };

  return (
    <ProtectedPage pageKey={['manager-schedules', 'admin-manager-schedules', 'admin-users']} requireEdit>
      <PageLayout
        title={MANAGER_SCHEDULE_LABELS.PAGE_TITLE}
        activePage="manager-schedules"
        sidebarOpen={sidebarOpen}
        onSidebarToggle={setSidebarOpen}
      >
        <div className={styles.toolbar}>
          <div className={styles.toolbarRow}>
            <button className={styles.clearCacheBtn} type="button" onClick={() => moveWeek(-7)}>
              <Icon.ChevronLeft />
              {MANAGER_SCHEDULE_LABELS.PREVIOUS_WEEK}
            </button>
            <div className={styles.dateControls}>
              <span className={styles.dateLabel}>{MANAGER_SCHEDULE_LABELS.WEEK_START}</span>
              <input
                className={styles.dateInput}
                type="date"
                value={weekStart}
                onChange={event => setWeekStart(toDateInputValue(getMonday(new Date(`${event.target.value}T00:00:00`))))}
              />
            </div>
            <button className={styles.clearCacheBtn} type="button" onClick={() => moveWeek(7)}>
              {MANAGER_SCHEDULE_LABELS.NEXT_WEEK}
              <Icon.ChevronRight />
            </button>
            <div className={styles.pushRight} />
            <button className={styles.clearCacheBtn} type="button" onClick={loadData} disabled={loading}>
              <Icon.Refresh />
              {MANAGER_SCHEDULE_LABELS.REFRESH}
            </button>
          </div>
        </div>

        <div className={styles.tableSection} style={{ marginBottom: 'var(--space-4)' }}>
          <div className={styles.tableHeader}>
            <div className={styles.groupHeader}>
              <Icon.CalendarDays size={15} />
              {MANAGER_SCHEDULE_LABELS.REGISTER_GRID_TITLE}
            </div>
          </div>
          <div className={styles.tablePanelBody}>
            <div className={styles.tableScrollWrapper}>
              <div style={{ minWidth: 1220, display: 'grid', gridTemplateColumns: '104px repeat(7, minmax(158px, 1fr))', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-comfortable)', overflow: 'visible' }}>
                <div style={{ padding: 'var(--space-2)', background: 'var(--bg-elevated)', borderRight: '1px solid var(--border-primary)', fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)' }}>
                  {MANAGER_SCHEDULE_LABELS.SESSION_COLUMN}
                </div>
                {weekDays.map(day => (
                  <div
                    key={day.value}
                    style={{
                      padding: 'var(--space-2)',
                      background: isRequiredWeekend(day.value) ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-elevated)',
                      borderRight: '1px solid var(--border-primary)',
                      borderTop: isRequiredWeekend(day.value) ? '2px solid var(--status-warning)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 590, color: isRequiredWeekend(day.value) ? 'var(--status-warning)' : 'var(--text-secondary)' }}>{day.label}</span>
                      {isRequiredWeekend(day.value) && (
                        <Badge variant="warning" size="sm" shape="rounded">{MANAGER_SCHEDULE_LABELS.REQUIRED_WEEKEND_BADGE}</Badge>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{formatShortDate(day.date)}</div>
                  </div>
                ))}

                {MANAGER_WORK_SESSIONS.map(sessionItem => (
                  <Fragment key={sessionItem.value}>
                    <div key={`${sessionItem.value}-label`} style={{ padding: 'var(--space-3)', borderTop: '1px solid var(--border-primary)', borderRight: '1px solid var(--border-primary)', background: 'var(--bg-surface)' }}>
                      <div style={{ fontSize: 13, fontWeight: 590, color: 'var(--text-primary)' }}>{sessionItem.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{sessionItem.time}</div>
                    </div>
                    {weekDays.map(day => {
                      const key = slotKey(day.date, sessionItem.value);
                      const peers = schedulesBySlot[key] || [];
                      const selectedCentre = slotCentres[key] || '';
                      const isSavingSlot = Boolean(savingSlots[key]);
                      const peersByCentre = peers.reduce<Record<string, ManagerScheduleRegistration[]>>((acc, item) => {
                        const centreKey = item.centreShortName || item.centreName || item.centreId;
                        acc[centreKey] = acc[centreKey] ?? [];
                        acc[centreKey].push(item);
                        return acc;
                      }, {});

                      return (
                        <div
                          key={key}
                          style={{
                            minWidth: 0,
                            minHeight: 168,
                            padding: 'var(--space-2)',
                            borderTop: '1px solid var(--border-primary)',
                            borderRight: '1px solid var(--border-primary)',
                            background: selectedCentre
                              ? 'rgba(94,106,210,0.06)'
                              : isRequiredWeekend(day.value)
                                ? 'rgba(245, 158, 11, 0.04)'
                                : 'var(--bg-surface)',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <CentreSelect
                              centres={centres}
                              selected={selectedCentre ? [selectedCentre] : []}
                              onChange={(ids) => void handleCentreChange(day.date, sessionItem.value, ids)}
                              placeholder={MANAGER_SCHEDULE_LABELS.CENTRE_PLACEHOLDER}
                              maxDisplay={1}
                              searchable
                              showRegionQuickSelect={false}
                              showSelectAll={false}
                              menuPosition="fixed"
                              extraOptions={[otherCentreOption]}
                            />
                          </div>
                          {selectedCentre === OTHER_CENTRE_OPTION_ID && (
                            <input
                              className={styles.dateInput}
                              style={{ width: '100%', marginTop: 'var(--space-2)' }}
                              value={customCentreNames[key] || ''}
                              placeholder={MANAGER_SCHEDULE_LABELS.OTHER_CENTRE_PLACEHOLDER}
                              onChange={event => setCustomCentreNames(prev => ({ ...prev, [key]: event.target.value }))}
                              onBlur={() => void handleCustomCentreSave(day.date, sessionItem.value)}
                              onKeyDown={event => {
                                if (event.key === 'Enter') {
                                  event.currentTarget.blur();
                                }
                              }}
                            />
                          )}
                          {selectedCentre && (
                            <input
                              className={styles.dateInput}
                              style={{ width: '100%', marginTop: 'var(--space-2)' }}
                              value={slotNotes[key] || ''}
                              placeholder={MANAGER_SCHEDULE_LABELS.SLOT_NOTE_PLACEHOLDER}
                              onChange={event => setSlotNotes(prev => ({ ...prev, [key]: event.target.value }))}
                              onBlur={() => void handleSlotNoteSave(day.date, sessionItem.value)}
                              onKeyDown={event => {
                                if (event.key === 'Enter') {
                                  event.currentTarget.blur();
                                }
                              }}
                            />
                          )}
                          {isSavingSlot && (
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>{MANAGER_SCHEDULE_LABELS.SAVING_SLOT}</div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
                            {Object.entries(peersByCentre).length === 0 ? (
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{MANAGER_SCHEDULE_LABELS.EMPTY_SLOT}</span>
                            ) : Object.entries(peersByCentre).map(([centreName, items]) => (
                              <div key={centreName} style={{ minWidth: 0, padding: '6px', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-comfortable)', background: 'var(--bg-elevated)' }}>
                                <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center', minWidth: 0 }}>
                                  <CentreBadge name={centreName} />
                                  <Badge variant="info" size="sm" shape="rounded">{items.length}</Badge>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6, minWidth: 0 }}>
                                  {items.map(item => (
                                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                                      <span
                                        title={displayManagerName(item, managerNamesByEmail)}
                                        style={{
                                          display: 'block',
                                          minWidth: 0,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          fontSize: 11,
                                          lineHeight: '16px',
                                          color: item.managerEmail.toLowerCase() === myEmail ? 'var(--brand-indigo)' : 'var(--text-secondary)',
                                          fontWeight: item.managerEmail.toLowerCase() === myEmail ? 590 : 400,
                                        }}
                                      >
                                        {displayManagerName(item, managerNamesByEmail)}
                                      </span>
                                      {item.note?.trim() && (
                                        <span className={styles.tooltipWrap}>
                                          <span className={styles.tooltipIcon}>i</span>
                                          <span className={`${styles.tooltipBox} ${styles.managerScheduleNoteTooltip}`}>{item.note.trim()}</span>
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </PageLayout>
    </ProtectedPage>
  );
}
