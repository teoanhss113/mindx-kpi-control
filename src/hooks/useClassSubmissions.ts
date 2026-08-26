'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Class } from '@/types/classes';
import {
  fetchStudentSubmissionsByClass,
  fetchStudentSubmissionsByClasses,
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
const BATCH_FETCH_ATTEMPTS = 2;
const BATCH_SIZE = 6;
const BATCH_WORKERS = 2;
const SUBMISSION_DATA_VERSION = 4;

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

export function useClassSubmissions(classes: Class[], autoLoad = true) {
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

    setRecords(previous => {
      const next = { ...previous };
      queue.forEach(classId => {
        next[classId] = { ...previous[classId], state: 'loading', error: undefined };
      });
      recordsRef.current = next;
      return next;
    });
    setLoading(true);
    const batches = Array.from(
      { length: Math.ceil(queue.length / BATCH_SIZE) },
      (_, index) => queue.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
    );
    const worker = async () => {
      while (batches.length > 0 && !controller.signal.aborted) {
        const batch = batches.shift();
        if (!batch) continue;

        let result: Awaited<ReturnType<typeof fetchStudentSubmissionsByClasses>> | undefined;
        let lastError: unknown;
        for (let attempt = 1; attempt <= BATCH_FETCH_ATTEMPTS; attempt += 1) {
          try {
            result = await fetchStudentSubmissionsByClasses(batch, controller.signal);
            break;
          } catch (error) {
            if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
            lastError = error;
            if (attempt < BATCH_FETCH_ATTEMPTS) {
              await waitForRetry(500, controller.signal).catch(() => undefined);
            }
          }
        }
        if (controller.signal.aborted) return;

        setRecords(previous => {
          const next = { ...previous };
          batch.forEach(classId => {
            const data = result?.data[classId];
            next[classId] = data
              ? { state: 'loaded', data, dataVersion: SUBMISSION_DATA_VERSION }
              : {
                  ...previous[classId],
                  state: 'error',
                  error: result?.errors[classId]
                    || (lastError instanceof Error ? lastError.message : 'Không thể tải dữ liệu bài tập'),
                };
          });
          recordsRef.current = next;
          return next;
        });
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(BATCH_WORKERS, batches.length) }, worker));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoLoad || !classIdsKey) {
      abortRef.current?.abort();
      return;
    }
    void loadClasses(classIds);
    return () => abortRef.current?.abort();
    // classIdsKey is the stable trigger; classIds itself changes with the Class[] identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, classIdsKey, loadClasses]);

  const reloadClass = useCallback((classId: string) => fetchClass(classId), [fetchClass]);
  const reloadAll = useCallback(() => loadClasses(classIds, true), [classIds, loadClasses]);
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

  return { records, loading, progress, cancelLoading, reloadClass, reloadAll };
}
