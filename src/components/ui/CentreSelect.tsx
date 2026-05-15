import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { MultiSelect, type SelectOption } from './index';

export interface Centre {
  id: string;
  shortName: string;
  name: string;
}

interface Region {
  id: string;
  name: string;
  centre_ids: string[];
}

interface CentreSelectProps {
  /** All available centres */
  centres: Centre[];
  /** Selected centre IDs */
  selected: string[];
  /** Change handler */
  onChange: (ids: string[]) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Maximum number of items to display before showing "x đã chọn" */
  maxDisplay?: number;
  /** Enable search functionality */
  searchable?: boolean;
  /** Filter centres to only show those in this list (for table-level filters) */
  filterToIds?: string[];
  /** Enable region quick select buttons */
  showRegionQuickSelect?: boolean;
  /** Position of the menu */
  menuPosition?: 'bottom' | 'top' | 'fixed';
  /** Show the bulk "Tất cả" option. Disable for single-centre picking. */
  showSelectAll?: boolean;
}

/**
 * CentreSelect - Reusable component for centre selection
 * 
 * Provides consistent centre display format across the application:
 * - Format: "shortName – name" (e.g., "HN1 – Hà Nội 1")
 * - Display: "x đã chọn" when multiple selected
 * - Search: By shortName or name
 * - Region Quick Select: Buttons to quickly select all centres in a region
 * 
 * @example
 * // With region quick select
 * <CentreSelect
 *   centres={allCentres}
 *   selected={selectedCentres}
 *   onChange={setSelectedCentres}
 *   placeholder="Tất cả cơ sở"
 *   searchable
 *   maxDisplay={1}
 *   showRegionQuickSelect
 * />
 * 
 * @example
 * // Table-level filter (only centres in loaded data)
 * <CentreSelect
 *   centres={allCentres}
 *   selected={selectedCentres}
 *   onChange={setSelectedCentres}
 *   placeholder="Tất cả cơ sở"
 *   searchable
 *   maxDisplay={1}
 *   filterToIds={centreIdsInData}
 *   showRegionQuickSelect
 * />
 */
export function CentreSelect({
  centres,
  selected,
  onChange,
  placeholder = 'Tất cả cơ sở',
  maxDisplay = 1,
  searchable = true,
  filterToIds,
  showRegionQuickSelect = false,
  menuPosition = 'bottom',
  showSelectAll = true,
}: CentreSelectProps) {
  const [regions, setRegions] = useState<Region[]>([]);

  const loadRegions = useCallback(async () => {
    try {
      const { supabase } = await import('@/lib/supabase/client');

      const { data: regionsData, error: regionsError } = await supabase
        .from('regions')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');

      if (regionsError || !regionsData || regionsData.length === 0) {
        setRegions([]);
        return;
      }

      const { data: regionCentresData, error: rcError } = await supabase
        .from('region_centres')
        .select('region_id, centre_id')
        .in('region_id', regionsData.map(r => r.id));

      if (rcError) {
        setRegions([]);
        return;
      }

      const regionsWithCentres: Region[] = regionsData.map(region => {
        const centreMappings = regionCentresData?.filter(rc => rc.region_id === region.id) || [];
        const centreIds = centreMappings.map(rc => rc.centre_id);

        const filteredCentreIds = filterToIds
          ? centreIds.filter(id => filterToIds.includes(id))
          : centreIds;

        return {
          id: region.id,
          name: region.name,
          centre_ids: filteredCentreIds,
        };
      });

      const nonEmptyRegions = regionsWithCentres.filter(r => r.centre_ids.length > 0);
      setRegions(nonEmptyRegions);
    } catch (error) {
      console.error('Failed to load regions:', error);
      setRegions([]);
    }
  }, [filterToIds]);

  // Load regions if showRegionQuickSelect is enabled
  useEffect(() => {
    if (!showRegionQuickSelect) return;
    const timer = window.setTimeout(() => void loadRegions(), 0);
    return () => window.clearTimeout(timer);
  }, [showRegionQuickSelect, loadRegions]);

  const options: SelectOption[] = useMemo(() => {
    // Filter centres if filterToIds is provided
    const filteredCentres = filterToIds
      ? centres.filter(c => filterToIds.includes(c.id))
      : centres;

    const centreOptions = filteredCentres.map(c => ({
      value: c.id,
      label: `${c.shortName} – ${c.name}`,
      searchTerms: [c.shortName, c.name],
    }));

    // Add region options at the top if enabled
    if (showRegionQuickSelect && regions.length > 0) {
      const regionOptions: SelectOption[] = regions.map(r => ({
        value: `region:${r.id}`,
        label: `${r.name} (${r.centre_ids.length} cơ sở)`,
        searchTerms: [r.name],
        isRegion: true, // Custom flag to identify region options
        regionCentreIds: r.centre_ids, // Store centre IDs for checking selection state
      }));

      return [...regionOptions, ...centreOptions];
    }

    return centreOptions;
  }, [centres, filterToIds, showRegionQuickSelect, regions]);

  // Custom onChange handler to handle region selection
  function handleChange(selectedValues: string[]) {
    // Check if any region was selected (newly added)
    const regionSelections = selectedValues.filter(v => v.startsWith('region:'));
    
    if (regionSelections.length > 0) {
      // Get centre-only values (not regions) from selectedValues
      const centreOnlyValues = selectedValues.filter(v => !v.startsWith('region:'));
      
      // Process each region
      let finalSelection = [...centreOnlyValues];
      
      regionSelections.forEach(regionValue => {
        const regionId = regionValue.replace('region:', '');
        const region = regions.find(r => r.id === regionId);
        
        if (region) {
          // Check if ALL centres in this region are already selected
          const allCentresSelected = region.centre_ids.every(centreId => 
            selected.includes(centreId)
          );

          if (allCentresSelected) {
            // DESELECT: Remove all centres from this region
            finalSelection = finalSelection.filter(id => !region.centre_ids.includes(id));
          } else {
            // SELECT: Add all centres from this region
            region.centre_ids.forEach(centreId => {
              if (!finalSelection.includes(centreId)) {
                finalSelection.push(centreId);
              }
            });
          }
        }
      });

      // Call onChange with only centre IDs (no region values)
      onChange(finalSelection);
    } else {
      // Normal centre selection (no regions involved)
      onChange(selectedValues);
    }
  }

  return (
    <MultiSelect
      options={options}
      selected={selected}
      onChange={handleChange}
      placeholder={placeholder}
      maxDisplay={maxDisplay}
      searchable={searchable}
      searchPlaceholder="Tìm cơ sở..."
      menuPosition={menuPosition}
      showSelectAll={showSelectAll}
    />
  );
}
