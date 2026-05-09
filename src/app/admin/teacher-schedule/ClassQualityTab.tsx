'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllClasses, haveSlotInToUtcRange } from '@/services/classesService';
import { Class } from '@/types/classes';
import { AnalyzedClassForQuality } from '@/types/classQuality';
import { analyzeClassQuality, DEFAULT_EXEMPTED_SESSIONS } from '@/lib/classQualityAnalysis';
import { useToast, Toolbar, EmptyState } from '@/components/ui';
import { MESSAGES, ENTITIES } from '@/constants';
import { ClassQualityUnifiedTable } from '@/components/ClassQualityUnifiedTable';

interface Props {
  centres: any[];
  selectedCentres: string[];
  onCentresChange: (v: string[]) => void;
  fromDate: string;
  toDate: string;
  onFromDateChange: (v: string) => void;
  onToDateChange: (v: string) => void;
  onRowClick?: (a: AnalyzedClassForQuality) => void;
}

export function ClassQualityTab({
  centres,
  selectedCentres,
  onCentresChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onRowClick,
}: Props) {
  const { addToast, removeToast } = useToast();
  
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    if (!fromDate || !toDate) {
      addToast(MESSAGES.ERROR.DATE_RANGE_REQUIRED, 'error');
      return;
    }
    if (abortController) {
      abortController.abort();
    }
    const controller = new AbortController();
    setAbortController(controller);
    setLoading(true);
    setProgress({ loaded: 0, total: 0 });
    setClasses([]);
    
    const tid = addToast(MESSAGES.LOADING.CONNECTING, 'loading');
    let accumulated: Class[] = [];
    try {
      const { from: hFrom, to: hTo } = haveSlotInToUtcRange(new Date(fromDate), new Date(toDate));
      const centreIds = selectedCentres.length > 0 ? selectedCentres : centres.map(c => c.id);
      
      const result = await fetchAllClasses(
        { haveSlotIn: { from: hFrom, to: hTo }, centres: centreIds },
        (loaded, total, chunk) => {
          setProgress({ loaded, total });
          accumulated = [...accumulated, ...chunk];
          setClasses([...accumulated]);
        },
        controller.signal
      );
      
      removeToast(tid);
      addToast(MESSAGES.LOADING.SUCCESS(result.length, ENTITIES.CLASSES), 'success');
    } catch (err: any) {
      if (err.message === 'Aborted' || err.name === 'AbortError') {
        removeToast(tid);
        addToast(MESSAGES.LOADING.STOPPED, 'info');
      } else {
        console.error(err);
        removeToast(tid);
        addToast(MESSAGES.ERROR.GENERIC, 'error');
      }
    } finally { 
      setLoading(false); 
      setAbortController(null);
    }
  };

  const handleCancelFetch = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  const analyzedClasses = useMemo(() => {
    return classes.map(cls => analyzeClassQuality(cls, DEFAULT_EXEMPTED_SESSIONS));
  }, [classes]);

  // Separate normal and cancelled classes
  const normalClasses = useMemo(() => {
    return analyzedClasses.filter(a => {
      const status = a.cls.status?.toUpperCase() || '';
      return status !== 'ABANDONED' && status !== 'REJECTED';
    });
  }, [analyzedClasses]);

  return (
    <div>
      <Toolbar
        centres={centres}
        selectedCentres={selectedCentres}
        onCentresChange={onCentresChange}
        centresLoading={centres.length === 0}
        dateFrom={fromDate}
        dateTo={toDate}
        onDateFromChange={onFromDateChange}
        onDateToChange={onToDateChange}
        onFetch={loadData}
        onCancel={handleCancelFetch}
        loading={loading}
        progress={progress}
        hasData={classes.length > 0}
        onClearCache={() => setClasses([])}
        showRegionQuickSelect={true}
      />
      
      <div style={{ marginTop: 'var(--space-4)' }}>
        {!loading && classes.length === 0 ? (
          <EmptyState
            icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>}
            title="Chưa có dữ liệu chất lượng lớp"
            subtitle={'Chọn khoảng thời gian và nhấn "Tải dữ liệu"'}
          />
        ) : (
          <ClassQualityUnifiedTable 
            classes={normalClasses} 
            search={search} 
            onSearchChange={setSearch}
            onRowClick={onRowClick}
          />
        )}
      </div>
    </div>
  );
}
