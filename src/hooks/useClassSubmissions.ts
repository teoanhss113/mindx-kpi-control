'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Class } from '@/types/classes';
import {
  fetchStudentSubmissionsByClass,
  type ClassSubmissionData,
} from '@/services/studentSubmissionService';

export type ClassSubmissionLoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface ClassSubmissionRecord {
  state: ClassSubmissionLoadState;
  data?: ClassSubmissionData;
  error?: string;
  dataVersion?: number;
}

const MAX_FETCH_ATTEMPTS = 3;
const SUBMISSION_DATA_VERSION = 3;

function waitForRetry(delayMs: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timeoutId = window.setTimeout(resolve, delayMs);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timeoutId);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

export function useClassSubmissions(classes: Class[]) {
  const [records, setRecords] = useState<Record<string, ClassSubmissionRecord>>({});
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const recordsRef = useRef(records);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  const classIds = useMemo(() => classes.map(cls => cls.id), [classes]);
  const classIdsKey = classIds.join('|');

  const fetchClass = useCallback(async (classId: string, signal?: AbortSignal) => {
    setRecords(previous => {
      const next = {
        ...previous,
        [classId]: { ...previous[classId], state: 'loading' as const, error: undefined },
      };
      recordsRef.current = next;
      return next;
    });
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
      try {
        const data = await fetchStudentSubmissionsByClass(classId, signal);
        setRecords(previous => {
          const next = { ...previous, [classId]: { state: 'loaded' as const, data, dataVersion: SUBMISSION_DATA_VERSION } };
          recordsRef.current = next;
          return next;
        });
        return data;
      } catch (error) {
        if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) return undefined;
        lastError = error;
        if (attempt < MAX_FETCH_ATTEMPTS) {
          await waitForRetry(attempt === 1 ? 400 : 1200, signal).catch(() => undefined);
          if (signal?.aborted) return undefined;
        }
      }
    }

    const message = lastError instanceof Error ? lastError.message : 'Không thể tải dữ liệu bài tập';
    setRecords(previous => {
      const next = { ...previous, [classId]: { ...previous[classId], state: 'error' as const, error: message } };
      recordsRef.current = next;
      return next;
    });
    return undefined;
  }, []);

  const loadClasses = useCallback(async (ids: string[], force = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const queue = ids.filter(id => (
      force
      || recordsRef.current[id]?.state !== 'loaded'
      || recordsRef.current[id]?.dataVersion !== SUBMISSION_DATA_VERSION
      || !recordsRef.current[id]?.data?.lessonSchedule?.length
    ));
    if (queue.length === 0) return;

    setLoading(true);
    const worker = async () => {
      while (queue.length > 0 && !controller.signal.aborted) {
        const classId = queue.shift();
        if (classId) await fetchClass(classId, controller.signal);
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [fetchClass]);

  useEffect(() => {
    if (!classIdsKey) return;
    void loadClasses(classIds);
    return () => abortRef.current?.abort();
    // classIdsKey is the stable trigger; classIds itself changes with the Class[] identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classIdsKey, loadClasses]);

  const reloadClass = useCallback((classId: string) => fetchClass(classId), [fetchClass]);
  const reloadAll = useCallback(() => loadClasses(classIds, true), [classIds, loadClasses]);
  const preloadClassIds = useCallback((ids: string[]) => loadClasses(ids), [loadClasses]);
  const cancelLoading = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  const progress = useMemo(() => {
    const scoped = classIds.map(id => records[id]);
    return {
      loaded: scoped.filter(record => record?.state === 'loaded').length,
      failed: scoped.filter(record => record?.state === 'error').length,
      total: classIds.length,
    };
  }, [classIds, records]);

  return { records, loading, progress, preloadClassIds, cancelLoading, reloadClass, reloadAll };
}
