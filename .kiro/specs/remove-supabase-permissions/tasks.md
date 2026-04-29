# Implementation Tasks: Remove Supabase Permissions System

## Overview

Remove all Supabase-based permission logic while keeping LMS authentication and Admin UI intact. This is a temporary simplification before redesigning the permission system.

## Tasks

- [x] 1. Phase 1: Update Type Definitions
  - [x] 1.1 Update AuthSession type
    - Open `src/types/auth.ts`
    - Remove `role` field from `AuthSession` interface
    - Update any type guards or validators
    - _Requirements: REQ-4_
  
  - [x] 1.2 Verify TypeScript compilation
    - Run `npm run build` to check for type errors
    - Fix any compilation errors related to removed `role` field
    - _Requirements: REQ-4_

- [x] 2. Phase 2: Update Core Services
  - [x] 2.1 Update authService.ts
    - Open `src/services/authService.ts`
    - Remove all Supabase imports (`getSupabaseClient`)
    - Remove role lookup logic from `signIn()` function
    - Remove all Supabase queries and try-catch blocks
    - Remove `role` field from session object creation
    - Remove all console.log statements related to Supabase
    - Keep only Firebase authentication logic
    - _Requirements: REQ-1_
  
  - [x] 2.2 Update permissionsService.ts
    - Open `src/services/permissionsService.ts`
    - Remove all Supabase imports
    - Simplify `getAllowedPages()` to return all pages:
      ```typescript
      export async function getAllowedPages(): Promise<PageKey[]> {
        return [
          'dashboard',
          'completion',
          'teacher-change',
          'tickets',
          'class-quality',
          'office-hours',
          'teacher-schedule',
          'resale',
        ];
      }
      ```
    - Simplify `hasPageAccess()` to always return true:
      ```typescript
      export async function hasPageAccess(pageKey: PageKey): Promise<boolean> {
        return true;
      }
      ```
    - Remove `PAGE_KEY_MAP` constant (no longer needed)
    - _Requirements: REQ-2_
  
  - [x] 2.3 Update useAllowedPages hook
    - Open `src/hooks/useAllowedPages.ts`
    - Remove `useState` and `useEffect` imports
    - Remove async loading logic
    - Return all pages immediately:
      ```typescript
      export function useAllowedPages() {
        const allPages: PageKey[] = [
          'dashboard',
          'completion',
          'teacher-change',
          'tickets',
          'class-quality',
          'office-hours',
          'teacher-schedule',
          'resale',
        ];
        
        return {
          allowedPages: allPages,
          loading: false,
          hasAccess: (pageKey: PageKey) => true,
        };
      }
      ```
    - _Requirements: REQ-3_
  
  - [x] 2.4 Test core services
    - Run `npm run build` to verify no TypeScript errors
    - Test login flow manually
    - Verify session is created without role field
    - _Requirements: REQ-1, REQ-2, REQ-3_

- [x] 3. Phase 3: Update Dashboard Page
  - [x] 3.1 Update Dashboard KPI cards filtering
    - Open `src/app/page.tsx`
    - Find `kpiCards` useMemo
    - Remove `allowedPages.includes()` checks
    - Keep only data availability checks (e.g., `completionRate !== null`)
    - Update dependencies array (remove `allowedPages`)
    - _Requirements: REQ-6_
  
  - [x] 3.2 Update Dashboard quick links filtering
    - In same file `src/app/page.tsx`
    - Find `quickLinks` useMemo
    - Remove `allowedPages.includes()` filter
    - Keep only disabled pages filter
    - Update dependencies array (remove `allowedPages`)
    - _Requirements: REQ-6_
  
  - [x] 3.3 Remove permission empty states
    - Remove "No permissions" empty state logic
    - Remove `hasPermissions` variable
    - Keep only "No data" empty state
    - _Requirements: REQ-6_
  
  - [x] 3.4 Test Dashboard page
    - Navigate to `/` and verify Dashboard loads
    - Verify all KPI cards show (when data available)
    - Verify all quick links show
    - Verify no console errors
    - _Requirements: REQ-6_

- [x] 4. Phase 4: Update Navigation
  - [x] 4.1 Update navigation configuration
    - Open `src/lib/navigation.tsx`
    - Find `getNavItemsWithRouter()` function
    - Remove `allowedPages` parameter
    - Remove permission filtering logic
    - Show all pages except disabled ones
    - _Requirements: REQ-9_
  
  - [x] 4.2 Update PageLayout component
    - Open `src/components/PageLayout.tsx`
    - Remove `allowedPages` prop if used
    - Remove permission filtering from navigation rendering
    - _Requirements: REQ-9_
  
  - [x] 4.3 Test navigation
    - Login and verify all pages show in sidebar
    - Click each navigation item and verify page loads
    - Verify active state highlights correctly
    - _Requirements: REQ-9_

- [x] 5. Phase 5: Update Other Pages Using Permissions
  - [x] 5.1 Search for useAllowedPages usage
    - Run: `grep -r "useAllowedPages" src/app/`
    - List all pages using the hook
    - _Requirements: REQ-5_
  
  - [x] 5.2 Update completion-rate page
    - Open `src/app/completion-rate/page.tsx`
    - Find `useAllowedPages()` usage
    - Remove permission filtering from navigation
    - Keep hook call if used for other purposes
    - _Requirements: REQ-5_
  
  - [x] 5.3 Update other pages
    - Repeat for each page found in step 5.1
    - Remove permission-based conditional rendering
    - Keep all UI components intact
    - _Requirements: REQ-5_
  
  - [x] 5.4 Test all pages
    - Navigate to each page and verify it loads
    - Verify no permission-related errors
    - Verify all features work
    - _Requirements: REQ-5_

- [-] 6. Phase 6: Update Admin Pages
  - [x] 6.1 Add "under development" banner component
    - Create reusable banner component or inline style
    - Style: warning color, centered text, icon
    - Message: "⚠️ Chức năng này đang được phát triển lại"
    - _Requirements: REQ-8_
  
  - [x] 6.2 Update Admin Users page
    - Open `src/app/admin/users/page.tsx`
    - Add banner at top of page
    - Disable all form inputs and buttons
    - Keep all UI components visible
    - _Requirements: REQ-7, REQ-8_
  
  - [x] 6.3 Update Admin Roles page
    - Open `src/app/admin/roles/page.tsx`
    - Add banner at top of page
    - Disable all form inputs and buttons
    - Keep all UI components visible
    - _Requirements: REQ-7, REQ-8_
  
  - [x] 6.4 Update Admin Regions page
    - Open `src/app/admin/regions/page.tsx`
    - Add banner at top of page
    - Disable all form inputs and buttons
    - Keep all UI components visible
    - _Requirements: REQ-7, REQ-8_
  
  - [x] 6.5 Update Admin index page
    - Open `src/app/admin/page.tsx`
    - Add banner at top of page
    - Keep all navigation cards visible
    - _Requirements: REQ-7, REQ-8_
  
  - [x] 6.6 Test Admin pages
    - Navigate to each Admin page
    - Verify banner displays
    - Verify all UI is visible but disabled
    - Verify no console errors
    - _Requirements: REQ-7, REQ-8_

- [ ] 7. Phase 7: Remove Supabase Files and Dependencies
  - [x] 7.1 Remove Supabase client files
    - Delete `src/lib/supabase/client.ts`
    - Delete `src/lib/supabase/` directory if empty
    - _Requirements: REQ-10_
  
  - [x] 7.2 Remove Supabase from package.json
    - Open `package.json`
    - Remove `@supabase/supabase-js` from dependencies
    - Run `npm install` to update lock file
    - _Requirements: REQ-10_
  
  - [x] 7.3 Remove Supabase environment variables
    - Open `.env.local`
    - Remove `NEXT_PUBLIC_SUPABASE_URL`
    - Remove `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - _Requirements: REQ-10_
  
  - [x] 7.4 Search for remaining Supabase imports
    - Run: `grep -r "supabase" src/`
    - Remove any remaining imports or references
    - _Requirements: REQ-10_
  
  - [x] 7.5 Verify build after cleanup
    - Run `npm run build`
    - Verify no errors related to Supabase
    - Verify no missing module errors
    - _Requirements: REQ-10_

- [ ] 8. Phase 8: Testing and Verification
  - [x] 8.1 Test login flow
    - Clear browser cache and localStorage
    - Navigate to `/login`
    - Login with valid LMS credentials
    - Verify redirect to Dashboard
    - Verify no console errors
    - _Success Criteria: 1, 3_
  
  - [x] 8.2 Test navigation
    - Verify all pages show in sidebar
    - Click each navigation item
    - Verify each page loads correctly
    - Verify active state highlights
    - _Success Criteria: 2, 5_
  
  - [x] 8.3 Test Dashboard page
    - Verify KPI cards display (when data available)
    - Verify alerts display (when thresholds met)
    - Verify quick links display
    - Click each card/link and verify navigation
    - _Success Criteria: 5_
  
  - [x] 8.4 Test all feature pages
    - Navigate to each page: completion-rate, teacher-change, tickets, etc.
    - Verify data loads correctly
    - Verify filters work
    - Verify no permission errors
    - _Success Criteria: 5_
  
  - [x] 8.5 Test Admin pages
    - Navigate to each Admin page
    - Verify "under development" banner shows
    - Verify UI is visible but disabled
    - Verify no console errors
    - _Success Criteria: 6_
  
  - [x] 8.6 Test with different users
    - Login with different LMS accounts
    - Verify all users see all pages
    - Verify no permission differences
    - _Success Criteria: 2_
  
  - [x] 8.7 Check console for errors
    - Open browser DevTools console
    - Navigate through all pages
    - Verify no Supabase-related errors
    - Verify no permission-related errors
    - _Success Criteria: 4, 8_
  
  - [x] 8.8 Verify build
    - Run `npm run build`
    - Verify build completes successfully
    - Verify no TypeScript errors
    - Verify no missing module errors
    - _Success Criteria: 7_
  
  - [x] 8.9 Test logout
    - Click logout button
    - Verify redirect to login page
    - Verify session cleared from localStorage
    - Verify cannot access pages without login
    - _Success Criteria: 1_

- [ ] 9. Phase 9: Documentation and Cleanup
  - [x] 9.1 Update README if needed
    - Remove Supabase setup instructions
    - Update environment variables section
    - Document simplified authentication flow
  
  - [x] 9.2 Clean up unused files
    - Remove SQL migration files (supabase/migrations/)
    - Remove SQL setup files (*.sql in root)
    - Keep only if needed for reference
  
  - [x] 9.3 Add comments to code
    - Add comment in authService: "Simplified - no role lookup"
    - Add comment in permissionsService: "Temporary - returns all pages"
    - Add comment in Admin pages: "UI only - functionality disabled"
  
  - [x] 9.4 Create migration notes
    - Document what was removed
    - Document what was kept
    - Document future work needed

- [x] 10. Checkpoint - Final Verification
  - Ensure all tests pass
  - Verify no Supabase queries are made
  - Verify all pages accessible after login
  - Verify build completes without errors

## Notes

- **Backward Compatibility**: Keep function signatures unchanged for easier future updates
- **Admin Pages**: Keep all UI components - only disable functionality
- **Testing**: Test with multiple users to ensure consistent behavior
- **Rollback**: Commit before starting for easy rollback if needed

## Success Criteria Checklist

- [ ] ✅ Users can log in via LMS API
- [ ] ✅ After login, users see ALL pages in navigation
- [ ] ✅ No Supabase queries during authentication
- [ ] ✅ No Supabase queries for permissions
- [ ] ✅ All pages load without permission errors
- [ ] ✅ Admin pages visible with "under development" message
- [ ] ✅ Build completes without errors
- [ ] ✅ No console errors related to permissions

## Estimated Time

- Phase 1-2: 1 hour (Core services)
- Phase 3-4: 1 hour (Dashboard and navigation)
- Phase 5: 1 hour (Other pages)
- Phase 6: 1 hour (Admin pages)
- Phase 7: 30 minutes (Cleanup)
- Phase 8: 1 hour (Testing)
- Phase 9: 30 minutes (Documentation)

**Total: ~6 hours**
