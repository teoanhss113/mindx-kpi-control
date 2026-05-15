'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminTableSection, TableToolbar, TableGroupHeader, SubTableGroupHeader, FilterChip, Icon, SortIcon, Badge, EmptyState, CentreBadge } from '@/components/ui';
import { surveyColor } from '@/lib/kpiScoring';
import { buildTeacherPointRowsFromGoogleSheets } from '@/lib/teacherPointKpi';
import styles from '@/app/dashboard.module.css';

interface GoogleSheetsSectionProps {
  classes: any[];
  fromDate: string;
  toDate: string;
  centres: any[];
  selectedCentres?: string[];
  externalRawData?: any[];
  parentLoading?: boolean;
  onDataProcessed?: (data: any[]) => void;
  onViewDetails?: (row: any) => void; 
}

export default function GoogleSheetsSection({ 
  classes, fromDate, toDate, centres, selectedCentres = [], 
  externalRawData = [], parentLoading = false,
  onDataProcessed, onViewDetails 
}: GoogleSheetsSectionProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [isExpanded, setIsExpanded] = useState(true);

  const rawData = externalRawData;
  const loading = parentLoading;

  // Logic unchanged

  // 2. Process & Filter data (Logic Unchanged)
  const processedData = useMemo(() => {
    return buildTeacherPointRowsFromGoogleSheets({
      rawData,
      classes,
      fromDate,
      toDate,
      centres,
      selectedCentres,
      search,
    });
  }, [rawData, classes, fromDate, toDate, search, centres, selectedCentres]);

  useEffect(() => {
    if (onDataProcessed) onDataProcessed(processedData);
  }, [processedData, onDataProcessed]);

  const sortedData = useMemo(() => {
    return [...processedData].sort((a, b) => {
      let valA: any = a[sortKey as keyof typeof a];
      let valB: any = b[sortKey as keyof typeof b];
      if (sortKey === 'timestamp') { valA = a.rowDate?.getTime() || 0; valB = b.rowDate?.getTime() || 0; }
      else if (sortKey === 'score') { valA = a.avgScore || 0; valB = b.avgScore || 0; }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [processedData, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // SHARED CSS CONFIGURATION: Matches LMS page layout exactly
  // REFINED GRID: Maintains symmetry for first 5 columns, fuses remaining for detailed responses
  const gridLayout = '40px minmax(0,1fr) minmax(0,2.5fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,2.2fr)';

  return (
    <div className={styles.tableSection} style={{ marginTop: 'var(--space-5)' }}>
      {/* SHARED COMPONENT HEADER: 100% design system compliant */}
      <SubTableGroupHeader 
        title="DANH SÁCH PHIẾU TỪ GOOGLE SHEETS"
        count={sortedData.length}
        icon={<Icon.Table size={14} />}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      />

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >

      {/* Contextual Toolbar: Wrapped in canonical tablePanelBody for standard internal spacing */}
      <div className={styles.tablePanelBody} style={{ paddingBottom: 0, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-primary)' }}>
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Lọc danh sách Google Sheet..."
          hasFilter={search.length > 0}
          onClearFilter={() => setSearch('')}
        />
      </div>

      {sortedData.length === 0 && !loading ? (
        <EmptyState title="Không có dữ liệu" subtitle="Không tìm thấy dòng nào khớp bộ lọc." icon={<Icon.FileText size={40} />} />
      ) : (
        <div className={styles.tableScrollWrapper}>
          {/* Table Headers: EXACTLY CLONED from main list */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: gridLayout,
            padding: '7px 16px', minWidth: 840,
            borderBottom: '1px solid var(--border-primary)',
            fontSize: 11, fontWeight: 590, color: 'var(--text-quaternary)',
            letterSpacing: '0.04em', textTransform: 'uppercase',
            background: 'var(--bg-elevated)',
          }}>
            <div /> {/* Checkbox spacer */}
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleSort('timestamp')}>
              Ngày tạo <SortIcon col="timestamp" sortKey={sortKey} sortDir={sortDir} />
            </div>
            <div>Học viên & Lớp</div>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleSort('score')}>
              Điểm <SortIcon col="score" sortKey={sortKey} sortDir={sortDir} />
            </div>
            <div>Cơ sở</div>
            <div>Phản hồi nổi bật</div>
          </div>

          {/* Loading Skeleton to match structure */}
          {loading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} style={{ display: 'grid', gridTemplateColumns: gridLayout, minWidth: 840 }}>
              <div /><div className={styles.skeletonBlock} /><div className={styles.skeletonBlock} /><div className={styles.skeletonBlock} /><div className={styles.skeletonBlock} /><div className={styles.skeletonBlock} /><div className={styles.skeletonBlock} />
            </div>
          ))}

          {/* Animated Rows matching LMS visual identity system perfectly */}
          <AnimatePresence initial={false}>
            {sortedData.map((item, index) => {
              const isMatched = !!item.matchedClass;
              // Color extraction matching LMS generator
              const rawScore = item.avgScore || 0;
              const themeColor = rawScore > 0 ? surveyColor(rawScore) : 'var(--text-tertiary)';
              const themeBg = themeColor.startsWith('var(') ? 'rgba(0,0,0,0.05)' : `${themeColor}15`;

              return (
                <motion.div
                  key={`${item.timestamp}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(index * 0.012, 0.3) }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: gridLayout,
                    padding: '10px 16px',
                    minWidth: 840,
                    borderBottom: '1px solid var(--border-primary)',
                    alignItems: 'start',
                    background: 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  onClick={() => onViewDetails?.(item)}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)')}
                >
                  {/* Col 1: Spacer */}
                  <div />

                  {/* Col 2: Created At */}
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {item.timestamp.split(' ')[0]}
                  </div>

                  {/* Col 3: Info (Học viên & Lớp) */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ paddingBottom: 4, fontWeight: 590, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {item.studentName || 'Vô danh'}
                      {item.matchedClass?.studentName && item.matchedClass?.studentName !== item.studentName && (
                         <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>({item.matchedClass.studentName})</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <Badge variant={isMatched ? 'passed' : 'exempt'} size="sm" style={{ fontSize: 10, padding: '0 4px' }}>
                         {isMatched ? 'KHỚP' : 'MÃ GỐC'}
                      </Badge>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                         {isMatched ? (item.matchedClass.className || item.matchedClass.name) : item.inputClassCode}
                      </span>
                    </div>
                  </div>

                  {/* Col 4: Score (USER REQUIRED EXACT BADGE SYNERGY!) */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 2 }}>
                    {item.avgScore ? (
                       <Badge
                         variant="custom"
                         size="sm"
                         shape="rounded"
                         customColors={{ background: themeBg, color: themeColor, border: themeBg }}
                         title="Điểm trung bình giáo viên"
                       >
                         TEACHER: ★ {item.avgScore.toFixed(1)}
                       </Badge>
                    ) : <span style={{ fontSize: 13, color: 'var(--text-quaternary)' }}>—</span>}
                  </div>

                  {/* Col 5: Centre */}
                  <div style={{ paddingTop: 2 }}>
                     {isMatched ? (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 510 }}>
                           {item.matchedClass.centreName || item.matchedClass.centre?.shortName}
                        </div>
                     ) : item.centerHint ? (
                        <CentreBadge name={item.centerHint} />
                     ) : (
                        <span style={{ fontSize: 13, color: 'var(--text-quaternary)' }}>—</span>
                     )}
                  </div>

                  {/* Col 6: Dual-Channel Rich Content Snippet (Robust extraction logic) */}
                  {(() => {
                    const rKeys = Object.keys(item.row || {});
                    const qAct = rKeys.find(k => k.toUpperCase().includes('THÊM HOẠT ĐỘNG GÌ TRONG LỚP HỌC'));
                    const qImp = rKeys.find(k => k.toUpperCase().includes('CẢI THIỆN ĐIỀU GÌ HƠN TRONG TƯƠNG LAI'));
                    
                    const valAct = qAct ? item.row[qAct] : null;
                    const valImp = qImp ? item.row[qImp] : null;

                    return (
                      <div style={{ paddingTop: 2, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                        
                        {/* Activity Suggestions (Col I) */}
                        {valAct && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                            <span style={{ color: 'var(--text-tertiary)', fontWeight: 590 }}>Hoạt động:</span> {valAct}
                          </div>
                        )}

                        {/* Improvement Suggestion (Col O) */}
                        {valImp && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            <span style={{ color: 'var(--text-tertiary)', fontWeight: 590 }}>Cải thiện:</span> {valImp}
                          </div>
                        )}

                        {!valAct && !valImp && (
                          <div style={{ fontSize: 12, color: 'var(--text-quaternary)', fontStyle: 'italic' }}>Không có phản hồi viết tay</div>
                        )}

                      </div>
                    );
                  })()}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
