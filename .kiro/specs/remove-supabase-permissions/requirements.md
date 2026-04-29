# Requirements: Remove Supabase Permissions System

## 1. Overview

Remove all Supabase-based permission logic while keeping LMS authentication and Admin UI intact. This is a temporary simplification - permission logic will be redesigned later.

## 2. Current State

### Authentication Flow
1. User logs in via LMS API (Firebase)
2. System queries Supabase `profiles` table for role
3. System queries Supabase `roles` and `role_permissions` tables
4. Navigation is filtered based on permissions

### Components Affected
- `src/services/authService.ts` - Queries Supabase for role
- `src/services/permissionsService.ts` - Queries Supabase for permissions
- `src/hooks/useAllowedPages.ts` - Uses permissions to filter pages
- All pages using `useAllowedPages()` hook
- Admin pages (keep UI, remove functionality)

## 3. Requirements

### 3.1 Remove Supabase Permission Queries

**REQ-1**: Remove all Supabase queries from `authService.ts`
- Remove role lookup from `profiles` table
- Keep LMS (Firebase) authentication logic
- Default all users to have full access

**REQ-2**: Simplify `permissionsService.ts`
- Remove all Supabase queries
- Return all pages for any authenticated user
- Keep function signatures for backward compatibility

**REQ-3**: Simplify `useAllowedPages` hook
- Return all pages immediately for authenticated users
- Remove loading state (no async needed)
- Keep hook interface unchanged

### 3.2 Update Authentication Session

**REQ-4**: Remove role from AuthSession
- Remove `role` field from session object
- Update TypeScript types
- Clean up session persistence

### 3.3 Update All Pages

**REQ-5**: Remove permission checks from pages
- Remove `useAllowedPages()` calls where used for filtering
- Remove permission-based conditional rendering
- Keep all UI components intact

**REQ-6**: Update Dashboard page
- Remove permission filtering for KPI cards
- Remove permission filtering for quick links
- Show all cards and links to authenticated users

### 3.4 Admin Pages

**REQ-7**: Keep Admin UI completely intact
- Do NOT remove any components
- Do NOT remove any pages
- Do NOT remove any styling
- Admin pages will be non-functional but visually present

**REQ-8**: Disable Admin functionality
- Add placeholder messages in Admin pages
- "Chức năng này đang được phát triển lại"
- Keep all forms and tables visible but disabled

### 3.5 Navigation

**REQ-9**: Show all navigation items
- Remove permission filtering from navigation
- Show all pages to all authenticated users
- Keep navigation order and styling

### 3.6 Environment & Configuration

**REQ-10**: Remove Supabase completely
- Remove Supabase env variables from `.env.local`
- Remove Supabase client setup files
- Remove Supabase library from dependencies
- Remove all Supabase-related code

## 4. Non-Requirements

- ❌ Do NOT remove Admin page components
- ❌ Do NOT remove Admin page routes
- ❌ Do NOT remove Admin page styling

## 5. Success Criteria

1. ✅ Users can log in via LMS API
2. ✅ After login, users see ALL pages in navigation
3. ✅ No Supabase queries are made during authentication
4. ✅ No Supabase queries are made for permissions
5. ✅ All pages load without permission errors
6. ✅ Admin pages are visible but show "under development" message
7. ✅ Build completes without errors
8. ✅ No console errors related to permissions

## 6. Migration Path

This is a **temporary simplification**. Future work will:
- Redesign permission system (TBD by user)
- Potentially use different database
- Re-enable Admin functionality with new logic

## 7. Affected Files

### To Modify
- `src/services/authService.ts`
- `src/services/permissionsService.ts`
- `src/hooks/useAllowedPages.ts`
- `src/types/auth.ts`
- `src/app/page.tsx` (Dashboard)
- `src/lib/navigation.tsx`
- `src/components/PageLayout.tsx`
- Admin pages: `src/app/admin/*/page.tsx`

### To Keep Unchanged
- All Admin UI components
- All Admin page routes

### To Remove
- `src/lib/supabase/` directory
- Supabase dependencies from `package.json`
- Supabase env variables from `.env.local`
