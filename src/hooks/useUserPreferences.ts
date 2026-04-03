/**
 * useUserPreferences Hook
 * 
 * Simplified - no Supabase permissions (returns empty preferences)
 * UI only - functionality disabled
 */

export interface UserPreferences {
  regions: string[]; // Region IDs
  centres: string[]; // Centre IDs (from regions)
  courses: string[]; // Course categories: Coding, Robotics, Art, Others
  loading: boolean;
  error: string | null;
  // NEW: Region-grouped data for dropdown
  regionGroups: Array<{
    regionId: string;
    regionName: string;
    centreIds: string[];
    courses: string[];
  }>;
}

export function useUserPreferences(): UserPreferences {
  // Simplified - return empty preferences immediately
  return {
    regions: [],
    centres: [],
    courses: [],
    loading: false,
    error: null,
    regionGroups: [],
  };
}

/**
 * Hook to get quick filter chips based on user preferences
 * Returns filter chips that can be used in Toolbar/TableToolbar
 */
export function useQuickFilterChips() {
  const preferences = useUserPreferences();

  return {
    // Centre chips - one chip per centre
    centreChips: preferences.centres,
    
    // Course chips - one chip per course category
    courseChips: preferences.courses,
    
    // Region groups for dropdown menu
    regionGroups: preferences.regionGroups,
    
    // Combined for easy access
    hasPreferences: preferences.centres.length > 0 || preferences.courses.length > 0,
    
    loading: preferences.loading,
    error: preferences.error,
  };
}
