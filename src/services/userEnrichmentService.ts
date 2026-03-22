/**
 * User Enrichment Service
 * Lấy thông tin chi tiết từ LMS API để hiển thị
 * Database chỉ lưu email, role, is_active
 */

import { findUserByEmail, type LMSUser } from './userLookupService';

export interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  is_active: boolean;
  created_at: string;
  // Enriched fields from LMS (not in database)
  username?: string;
  full_name?: string;
  lms_data?: LMSUser | null;
}

export interface EnrichedProfile extends Profile {
  username: string;
  full_name: string;
  lms_data: LMSUser | null;
}

/**
 * Enrich single profile với thông tin từ LMS
 */
export async function enrichProfile(profile: Profile): Promise<EnrichedProfile> {
  try {
    const lmsUser = await findUserByEmail(profile.email);
    
    if (!lmsUser) {
      // User not found in LMS - return empty strings
      return {
        ...profile,
        username: '',
        full_name: '',
        lms_data: null,
      };
    }
    
    // Use fullName or displayName from LMS
    const fullName = lmsUser.fullName || lmsUser.displayName || '';
    
    return {
      ...profile,
      username: lmsUser.username || '',
      full_name: fullName,
      lms_data: lmsUser,
    };
  } catch (error) {
    console.error(`Error enriching profile ${profile.email}:`, error);
    
    // Fallback to empty strings on error
    return {
      ...profile,
      username: '',
      full_name: '',
      lms_data: null,
    };
  }
}

/**
 * Enrich multiple profiles với thông tin từ LMS
 * Sử dụng Promise.allSettled để không fail toàn bộ nếu 1 user lỗi
 */
export async function enrichProfiles(profiles: Profile[]): Promise<EnrichedProfile[]> {
  const enrichmentPromises = profiles.map(profile => enrichProfile(profile));
  const results = await Promise.allSettled(enrichmentPromises);
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      // Fallback nếu enrichment fail - return empty strings
      const profile = profiles[index];
      console.error(`Failed to enrich profile ${profile.email}:`, result.reason);
      
      return {
        ...profile,
        username: '',
        full_name: '',
        lms_data: null,
      };
    }
  });
}

/**
 * Batch enrich với caching để tránh gọi API nhiều lần
 */
const enrichmentCache = new Map<string, { data: EnrichedProfile; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function enrichProfilesCached(profiles: Profile[]): Promise<EnrichedProfile[]> {
  const now = Date.now();
  const results: EnrichedProfile[] = [];
  const toFetch: Profile[] = [];
  
  // Check cache first
  for (const profile of profiles) {
    const cached = enrichmentCache.get(profile.email);
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      // Update with latest role/active status from database
      results.push({
        ...cached.data,
        role: profile.role,
        is_active: profile.is_active,
      });
    } else {
      toFetch.push(profile);
    }
  }
  
  // Fetch missing profiles
  if (toFetch.length > 0) {
    const enriched = await enrichProfiles(toFetch);
    
    // Update cache
    enriched.forEach(profile => {
      enrichmentCache.set(profile.email, {
        data: profile,
        timestamp: now,
      });
    });
    
    results.push(...enriched);
  }
  
  // Sort to maintain original order
  return results.sort((a, b) => {
    const aIndex = profiles.findIndex(p => p.email === a.email);
    const bIndex = profiles.findIndex(p => p.email === b.email);
    return aIndex - bIndex;
  });
}

/**
 * Clear cache for specific email or all
 */
export function clearEnrichmentCache(email?: string) {
  if (email) {
    enrichmentCache.delete(email);
  } else {
    enrichmentCache.clear();
  }
}
