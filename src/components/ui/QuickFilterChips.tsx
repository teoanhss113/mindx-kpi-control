/**
 * QuickFilterChips Component
 * 
 * Displays filter chips based on user preferences
 * Auto-generated from user_permissions (regions + courses)
 * 
 * Purpose: Quick filtering shortcuts, NOT access control
 * 
 * UX Logic:
 * - 1 region: Click button → toggle on/off directly
 * - 2+ regions: Click button → show dropdown menu to select region
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuickFilterChips } from '@/hooks/useUserPreferences';
import { Icon, FilterChip } from './index';
import styles from '@/app/dashboard.module.css';

interface QuickFilterChipsProps {
  // Centre filter
  centres?: { id: string; shortName: string; name: string }[];
  selectedCentres: string[];
  onCentresChange: (centres: string[]) => void;
  
  // Course filter (optional)
  selectedCourses?: string[];
  onCoursesChange?: (courses: string[]) => void;
  
  // Show/hide
  showCentres?: boolean;
  showCourses?: boolean;
}

export function QuickFilterChips({
  centres = [],
  selectedCentres,
  onCentresChange,
  selectedCourses = [],
  onCoursesChange,
  showCentres = true,
  showCourses = false,
}: QuickFilterChipsProps) {
  const { centreChips, courseChips, regionGroups, hasPreferences, loading } = useQuickFilterChips();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  if (loading || !hasPreferences) return null;

  const hasMultipleRegions = regionGroups.length > 1;

  // Check if all preferences are currently applied
  const allCentresSelected = centreChips.every(id => selectedCentres.includes(id));
  const allCoursesSelected = courseChips.every(course => selectedCourses.includes(course));
  const isAllActive = allCentresSelected && (showCourses ? allCoursesSelected : true);

  // Check which region is active (if any)
  // A region is active ONLY if its centres are selected AND no other region's centres are selected
  const activeRegion = regionGroups.find(rg => {
    // Check if this region's centres are all selected
    const thisRegionCentresMatch = rg.centreIds.every(id => selectedCentres.includes(id));
    const thisRegionCoursesMatch = showCourses ? rg.courses.every(c => selectedCourses.includes(c)) : true;
    
    if (!thisRegionCentresMatch || !thisRegionCoursesMatch) return false;
    
    // Check if ANY other region's centres are also selected
    const otherRegionsHaveSelection = regionGroups.some(otherRg => {
      if (otherRg.regionId === rg.regionId) return false; // Skip self
      return otherRg.centreIds.some(id => selectedCentres.includes(id));
    });
    
    // This region is active ONLY if no other regions have selections
    return !otherRegionsHaveSelection;
  });

  const handleApplyAll = () => {
    if (isAllActive) {
      // Deactivate - clear all preferences
      if (showCentres) {
        onCentresChange(selectedCentres.filter(id => !centreChips.includes(id)));
      }
      if (showCourses && onCoursesChange) {
        onCoursesChange(selectedCourses.filter(c => !courseChips.includes(c)));
      }
    } else {
      // Activate - apply all preferences
      if (showCentres) {
        const newCentres = [...new Set([...selectedCentres, ...centreChips])];
        onCentresChange(newCentres);
      }
      if (showCourses && onCoursesChange) {
        const newCourses = [...new Set([...selectedCourses, ...courseChips])];
        onCoursesChange(newCourses);
      }
    }
  };

  const handleApplyRegion = (regionGroup: typeof regionGroups[0]) => {
    const isActive = activeRegion?.regionId === regionGroup.regionId;
    
    if (isActive) {
      // Deactivate this region
      if (showCentres) {
        onCentresChange(selectedCentres.filter(id => !regionGroup.centreIds.includes(id)));
      }
      if (showCourses && onCoursesChange) {
        onCoursesChange(selectedCourses.filter(c => !regionGroup.courses.includes(c)));
      }
    } else {
      // Activate this region (replace current selection)
      if (showCentres) {
        // Remove all other region centres, add this region's centres
        const otherRegionCentres = regionGroups
          .filter(rg => rg.regionId !== regionGroup.regionId)
          .flatMap(rg => rg.centreIds);
        const newCentres = [
          ...selectedCentres.filter(id => !otherRegionCentres.includes(id) && !regionGroup.centreIds.includes(id)),
          ...regionGroup.centreIds
        ];
        onCentresChange(newCentres);
      }
      if (showCourses && onCoursesChange) {
        // Remove all other region courses, add this region's courses
        const otherRegionCourses = regionGroups
          .filter(rg => rg.regionId !== regionGroup.regionId)
          .flatMap(rg => rg.courses);
        const newCourses = [
          ...selectedCourses.filter(c => !otherRegionCourses.includes(c) && !regionGroup.courses.includes(c)),
          ...regionGroup.courses
        ];
        onCoursesChange(newCourses);
      }
    }
    
    setShowDropdown(false);
  };

  const handleButtonClick = () => {
    if (hasMultipleRegions) {
      setShowDropdown(!showDropdown);
    } else {
      // Single region: toggle directly
      handleApplyAll();
    }
  };

  // Build label
  const parts: string[] = [];
  if (showCentres && centreChips.length > 0) {
    parts.push(`${centreChips.length} cơ sở`);
  }
  if (showCourses && courseChips.length > 0) {
    parts.push(`${courseChips.length} khối`);
  }
  const label = parts.length > 0 ? parts.join(' · ') : 'Phạm vi quản lý';

  const isActive = isAllActive || !!activeRegion;

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <FilterChip
        active={isActive}
        onClick={handleButtonClick}
        count={hasMultipleRegions ? regionGroups.length : undefined}
        countDisplay={hasMultipleRegions ? 'always' : 'never'}
        style={{
          background: isActive ? 'var(--brand-indigo)' : 'var(--bg-surface)',
          color: isActive ? 'white' : 'var(--text-secondary)',
          borderColor: isActive ? 'var(--brand-indigo)' : 'var(--border-secondary)',
          fontWeight: isActive ? 510 : 400,
        }}
      >
        Phạm vi quản lý
        {!isActive && <span style={{ opacity: 0.7, marginLeft: 4 }}>({label})</span>}
        {hasMultipleRegions && (
          <span style={{ marginLeft: 4, display: 'inline-flex', alignItems: 'center' }}>
            <Icon.ChevronDown />
          </span>
        )}
      </FilterChip>

      {/* Dropdown Menu */}
      {showDropdown && hasMultipleRegions && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          minWidth: 240,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-comfortable)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* All regions option */}
          <button
            type="button"
            onClick={handleApplyAll}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              background: isAllActive ? 'var(--bg-elevated)' : 'transparent',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: 'var(--text-primary)',
              transition: 'background 0.1s ease',
            }}
            onMouseEnter={e => {
              if (!isAllActive) e.currentTarget.style.background = 'var(--bg-elevated)';
            }}
            onMouseLeave={e => {
              if (!isAllActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            <div style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isAllActive && (
                <span style={{ color: 'var(--brand-indigo)', display: 'inline-flex' }}>
                  <Icon.Check size={14} />
                </span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 510 }}>Tất cả khu vực</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {label}
              </div>
            </div>
          </button>

          <div style={{ height: 1, background: 'var(--border-primary)' }} />

          {/* Individual region options */}
          {regionGroups.map(rg => {
            const isRegionActive = activeRegion?.regionId === rg.regionId;
            const regionParts: string[] = [];
            if (showCentres && rg.centreIds.length > 0) {
              regionParts.push(`${rg.centreIds.length} cơ sở`);
            }
            if (showCourses && rg.courses.length > 0) {
              regionParts.push(`${rg.courses.length} khối`);
            }
            const regionLabel = regionParts.join(' · ');

            return (
              <button
                key={rg.regionId}
                type="button"
                onClick={() => handleApplyRegion(rg)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  background: isRegionActive ? 'var(--bg-elevated)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={e => {
                  if (!isRegionActive) e.currentTarget.style.background = 'var(--bg-elevated)';
                }}
                onMouseLeave={e => {
                  if (!isRegionActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isRegionActive && (
                    <span style={{ color: 'var(--brand-indigo)', display: 'inline-flex' }}>
                      <Icon.Check size={14} />
                    </span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 510 }}>{rg.regionName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {regionLabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
