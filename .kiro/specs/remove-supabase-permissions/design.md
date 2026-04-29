# Design: Remove Supabase Permissions System

## 1. Overview

This design document outlines the approach to remove all Supabase-based permission logic while maintaining LMS authentication and Admin UI. The goal is to simplify the authentication flow and remove database dependencies for permissions.

## 2. Architecture Changes

### 2.1 Before (Current State)

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │ Login
       ▼
┌─────────────────────────────────────┐
│  LMS API (Firebase)                 │
│  - Authenticate user                │
│  - Return idToken, refreshToken     │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Supabase Database                  │
│  - Query profiles table for role    │
│  - Query roles table                │
│  - Query role_permissions table     │
│  - Query pages table                │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Session Storage                    │
│  - Store: idToken, role, email      │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Navigation Filtering               │
│  - Filter pages by permissions      │
│  - Show only allowed pages          │
└─────────────────────────────────────┘
```

### 2.2 After (New State)

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │ Login
       ▼
┌─────────────────────────────────────┐
│  LMS API (Firebase)                 │
│  - Authenticate user                │
│  - Return idToken, refreshToken     │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Session Storage                    │
│  - Store: idToken, email            │
│  - NO role, NO permissions          │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Navigation                         │
│  - Show ALL pages                   │
│  - No filtering                     │
└─────────────────────────────────────┘
```

## 3. Component Changes

### 3.1 Authentication Service (`src/services/authService.ts`)

**Changes:**
- Remove all Supabase imports
- Remove role lookup logic
- Remove `role` field from `AuthSession`
- Simplify `signIn()` function

**Before:**
```typescript
export async function signIn(email: string, password: string): Promise<AuthSession> {
  // 1. Firebase auth
  const data = await firebaseAuth();
  
  // 2. Supabase role lookup
  const supabase = getSupabaseClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('email', data.email)
    .single();
  
  // 3. Create session with role
  const session = {
    idToken: data.idToken,
    role: profile?.role || 'viewer',
    // ...
  };
}
```

**After:**
```typescript
export async function signIn(email: string, password: string): Promise<AuthSession> {
  // 1. Firebase auth only
  const data = await firebaseAuth();
  
  // 2. Create session without role
  const session = {
    idToken: data.idToken,
    email: data.email,
    // NO role field
  };
  
  return session;
}
```

### 3.2 Permissions Service (`src/services/permissionsService.ts`)

**Changes:**
- Remove all Supabase imports
- Return all pages for authenticated users
- Keep function signatures for backward compatibility

**Before:**
```typescript
export async function getAllowedPages(): Promise<PageKey[]> {
  const supabase = getSupabaseClient();
  // Complex queries to profiles, roles, role_permissions, pages
  return allowedPages;
}
```

**After:**
```typescript
export async function getAllowedPages(): Promise<PageKey[]> {
  // Return all pages immediately
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

### 3.3 useAllowedPages Hook (`src/hooks/useAllowedPages.ts`)

**Changes:**
- Remove async loading
- Return all pages immediately
- Keep interface unchanged

**Before:**
```typescript
export function useAllowedPages() {
  const [allowedPages, setAllowedPages] = useState<PageKey[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadAllowedPages(); // Async Supabase query
  }, []);
  
  return { allowedPages, loading };
}
```

**After:**
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
    hasAccess: () => true,
  };
}
```

### 3.4 Dashboard Page (`src/app/page.tsx`)

**Changes:**
- Remove permission filtering for KPI cards
- Remove permission filtering for quick links
- Simplify logic

**Before:**
```typescript
const kpiCards = useMemo(() => {
  const cards = [];
  
  if (allowedPages.includes('completion') && completionRate !== null) {
    cards.push({ ... });
  }
  
  if (allowedPages.includes('teacher-change') && teacherChangeRate !== null) {
    cards.push({ ... });
  }
  
  return cards;
}, [allowedPages, ...]);
```

**After:**
```typescript
const kpiCards = useMemo(() => {
  const cards = [];
  
  // No permission check
  if (completionRate !== null) {
    cards.push({ key: 'completion', ... });
  }
  
  if (teacherChangeRate !== null) {
    cards.push({ key: 'teacher-change', ... });
  }
  
  return cards;
}, [completionRate, teacherChangeRate, ...]);
```

### 3.5 Admin Pages

**Changes:**
- Add "under development" banner
- Disable all forms and actions
- Keep all UI components visible

**Implementation:**
```typescript
export default function AdminPage() {
  return (
    <PageLayout title="Quản trị" activePage="admin">
      {/* Under development banner */}
      <div style={{
        background: 'var(--status-warning)',
        color: 'white',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-card)',
        marginBottom: 'var(--space-4)',
        textAlign: 'center',
      }}>
        ⚠️ Chức năng này đang được phát triển lại
      </div>
      
      {/* Keep all existing UI */}
      <ExistingAdminUI disabled={true} />
    </PageLayout>
  );
}
```

## 4. Type Changes

### 4.1 AuthSession Type

**Before:**
```typescript
export interface AuthSession {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
  uid: string;
  displayName: string;
  email: string;
  provider: 'firebase';
  role: 'admin' | 'manager' | 'viewer';  // ← Remove this
}
```

**After:**
```typescript
export interface AuthSession {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
  uid: string;
  displayName: string;
  email: string;
  provider: 'firebase';
  // NO role field
}
```

## 5. Files to Remove

### 5.1 Supabase Client
- `src/lib/supabase/client.ts`
- `src/lib/supabase/` directory

### 5.2 Dependencies
Remove from `package.json`:
- `@supabase/supabase-js`

### 5.3 Environment Variables
Remove from `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 6. Migration Steps

### Phase 1: Update Core Services
1. Update `authService.ts` - remove Supabase queries
2. Update `permissionsService.ts` - return all pages
3. Update `useAllowedPages.ts` - remove async logic
4. Update `AuthSession` type - remove role field

### Phase 2: Update Pages
1. Update Dashboard page - remove permission filtering
2. Update all pages using `useAllowedPages()`
3. Update navigation - remove permission filtering

### Phase 3: Update Admin Pages
1. Add "under development" banners
2. Disable forms and actions
3. Keep all UI components

### Phase 4: Cleanup
1. Remove Supabase client files
2. Remove Supabase from package.json
3. Remove Supabase env variables
4. Remove unused imports

### Phase 5: Testing
1. Test login flow
2. Test navigation (all pages visible)
3. Test all pages load correctly
4. Test build completes
5. Verify no console errors

## 7. Backward Compatibility

### 7.1 Hook Interface
Keep `useAllowedPages()` interface unchanged:
```typescript
// Interface stays the same
const { allowedPages, loading, hasAccess } = useAllowedPages();

// But implementation is simplified
// - allowedPages: always returns all pages
// - loading: always false
// - hasAccess: always returns true
```

### 7.2 Function Signatures
Keep function signatures in `permissionsService.ts`:
```typescript
// Functions stay the same
export async function getAllowedPages(): Promise<PageKey[]>
export async function hasPageAccess(pageKey: PageKey): Promise<boolean>

// But implementation is simplified
// - getAllowedPages: returns all pages
// - hasPageAccess: always returns true
```

## 8. Error Handling

### 8.1 Login Errors
- Only handle Firebase auth errors
- No Supabase errors to handle
- Simpler error messages

### 8.2 Page Access
- No permission errors
- All authenticated users can access all pages
- Redirect to login if not authenticated

## 9. Performance Impact

### 9.1 Improvements
- ✅ Faster login (no Supabase queries)
- ✅ Faster page loads (no permission checks)
- ✅ Reduced network requests
- ✅ Simpler code (easier to maintain)

### 9.2 Bundle Size
- ✅ Smaller bundle (remove Supabase library)
- ✅ Fewer dependencies

## 10. Future Considerations

This is a **temporary simplification**. Future work may include:
- New permission system design
- Different database solution
- Re-enable Admin functionality
- Role-based access control (different approach)

## 11. Testing Strategy

### 11.1 Unit Tests
- Test `signIn()` returns session without role
- Test `getAllowedPages()` returns all pages
- Test `useAllowedPages()` returns all pages immediately

### 11.2 Integration Tests
- Test login flow end-to-end
- Test navigation shows all pages
- Test all pages load without errors

### 11.3 Manual Testing
- Login with different users
- Navigate to all pages
- Verify no console errors
- Verify build completes

## 12. Rollback Plan

If issues arise:
1. Revert changes to `authService.ts`
2. Revert changes to `permissionsService.ts`
3. Restore Supabase client
4. Restore environment variables
5. Run `npm install` to restore dependencies

Git commit before starting implementation for easy rollback.
