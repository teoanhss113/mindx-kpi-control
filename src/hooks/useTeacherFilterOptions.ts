import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UserSearchResult } from '@/components/ui/UserSearchInput';
import { searchTeachers, Teacher } from '@/services/officeHoursService';

export type TeacherFilterSelection = Partial<Teacher> & UserSearchResult & { id: string };

function getTeacherLabel(teacher: Teacher): string {
  const name = teacher.fullName || teacher.username || teacher.email || teacher.code || teacher.id;
  return teacher.code ? `${name} (${teacher.code})` : name;
}

export function useTeacherFilterOptions() {
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherFilterSelection | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);

    if (timerRef.current) clearTimeout(timerRef.current);

    const query = value.trim();
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const response = await searchTeachers(query, 0, 20);
        setResults(response.data);
      } catch (error) {
        console.error('Failed to search teachers:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleSelect = useCallback((teacher: UserSearchResult) => {
    const selected = teacher as TeacherFilterSelection;
    setSelectedTeacher(selected);
    setSearch('');
    setResults([selected as Teacher]);
  }, []);

  const hydrateSelectedTeacher = useCallback((teacher: TeacherFilterSelection | null) => {
    if (!teacher) {
      setSelectedTeacher(null);
      setResults([]);
      return;
    }

    setSelectedTeacher(teacher);
    setSearch('');
    setResults([teacher as Teacher]);
  }, []);

  const clear = useCallback(() => {
    setSelectedTeacher(null);
    setSearch('');
    setResults([]);
    setLoading(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const selectedTeacherName = useMemo(() => (
    selectedTeacher ? getTeacherLabel(selectedTeacher as Teacher) : undefined
  ), [selectedTeacher]);

  return {
    selectedTeacherId: selectedTeacher?.id || '',
    selectedTeacherName,
    teacherSearch: search,
    teacherSearchResults: results as UserSearchResult[],
    teachersLoading: loading,
    onTeacherSearchChange: handleSearchChange,
    onTeacherSelect: handleSelect,
    onTeacherClear: clear,
    hydrateSelectedTeacher,
  };
}
