# 🔐 Token Management Fix - Session Persistence

## 🎯 Vấn đề

User đăng nhập thành công và truy cập được `/admin`, nhưng sau khi reload trang thì bị redirect về `/` mặc dù sidebar vẫn hiển thị thông tin đăng nhập.

### Root Causes

1. **Token expiry không được xử lý đúng**
   - Token chỉ refresh khi còn 60 giây trước khi hết hạn (quá ngắn)
   - Không có retry logic khi gặp 401 error
   - Không có error handling cho token expired

2. **ProtectedPage check permissions mỗi lần render**
   - Mỗi lần reload trang, gọi lại `/api/auth/sync-user`
   - Nếu token invalid → API fail → redirect về `/`
   - Không có cơ chế auto-refresh token

3. **AuthContext không validate token khi app load**
   - Chỉ load session từ localStorage mà không check validity
   - Không tự động refresh token khi sắp hết hạn

## ✅ Giải pháp đã implement

### 1. Improved Token Refresh Logic

**File:** `src/services/authService.ts`

**Thay đổi:**
- Tăng buffer time từ 60 giây → **5 phút**
- Thêm error handling và logging
- Auto clear session khi refresh fail

```typescript
// Before: Refresh 60 seconds before expiry
if (Date.now() >= session.expiresAt - 60_000) {
  session = await refreshSession(session);
}

// After: Refresh 5 minutes before expiry with error handling
const bufferTime = 5 * 60 * 1000; // 5 minutes
if (now >= session.expiresAt - bufferTime) {
  try {
    console.log('[getValidToken] Token expiring soon, refreshing...');
    session = await refreshSession(session);
  } catch (error) {
    console.error('[getValidToken] Token refresh failed:', error);
    clearSession();
    throw new Error('Session expired - please login again');
  }
}
```

### 2. Auto-Retry on 401 Error

**File:** `src/lib/auth/clientAuth.ts`

**Thay đổi:**
- Detect 401 response
- Attempt token refresh
- Retry request with new token
- Auto logout if refresh fails

```typescript
const response = await fetch(input, { ...init, headers });

// If 401, try to refresh token and retry once
if (response.status === 401) {
  console.log('[authFetch] Got 401, attempting token refresh...');
  
  try {
    const session = await loadSession();
    if (session) {
      const newSession = await refreshSession(session);
      
      // Retry with new token
      const newHeaders = new Headers(init.headers);
      newHeaders.set('Authorization', `Bearer ${newSession.idToken}`);
      return fetch(input, { ...init, headers: newHeaders });
    }
  } catch (refreshError) {
    console.error('[authFetch] Token refresh failed:', refreshError);
    clearSession();
    throw new Error('Session expired - please login again');
  }
}
```

### 3. Better Error Handling in ProtectedPage

**File:** `src/components/ProtectedPage.tsx`

**Thay đổi:**
- Check for 401 status → auto logout
- Check for "Session expired" error → auto logout
- Better logging for debugging

```typescript
if (!res.ok) {
  // If 401, session is invalid - logout
  if (res.status === 401) {
    console.log('[ProtectedPage] 401 error, logging out...');
    logout();
    return;
  }
  router.replace('/');
  return;
}

// In catch block
if (error instanceof Error && error.message.includes('Session expired')) {
  logout();
  return;
}
```

### 4. Token Validation on App Load

**File:** `src/lib/AuthContext.tsx`

**Thay đổi:**
- Check token validity khi app load
- Auto refresh nếu token sắp hết hạn (trong 5 phút)
- Clear session nếu token đã expired

```typescript
async function initializeAuth() {
  const stored = loadSession();
  
  if (!stored) {
    setIsLoading(false);
    return;
  }

  // Check if token is still valid
  if (!isAuthenticated()) {
    console.log('[AuthProvider] Session expired, clearing...');
    clearSession();
    setSession(null);
    setIsLoading(false);
    return;
  }

  // Check if token needs refresh (within 5 minutes of expiry)
  const now = Date.now();
  const bufferTime = 5 * 60 * 1000; // 5 minutes
  
  if (now >= stored.expiresAt - bufferTime) {
    console.log('[AuthProvider] Token expiring soon, refreshing...');
    try {
      const refreshed = await refreshSession(stored);
      setSession(refreshed);
    } catch (error) {
      console.error('[AuthProvider] Token refresh failed:', error);
      clearSession();
      setSession(null);
    }
  } else {
    setSession(stored);
  }
  
  setIsLoading(false);
}
```

### 5. Better Logging in PermissionsContext

**File:** `src/lib/PermissionsContext.tsx`

**Thay đổi:**
- Thêm logging để debug
- Better error messages

## 🎯 Kết quả

### Before (Vấn đề)
```
1. User login → Token valid → Access /admin ✅
2. Wait 5 minutes...
3. Reload page → Token expired → API 401 → Redirect to / ❌
4. Sidebar still shows user info (confusing) ❌
```

### After (Fixed)
```
1. User login → Token valid → Access /admin ✅
2. Wait 5 minutes...
3. Reload page → Token expiring soon → Auto refresh ✅
4. Continue working → Access /admin ✅
5. If refresh fails → Auto logout → Redirect to /login ✅
```

## 🔍 Debug & Monitoring

### Console Logs Added

Bạn có thể monitor token lifecycle trong browser console:

```
[AuthProvider] Token expiring soon, refreshing...
[getValidToken] Token expiring soon, refreshing...
[authFetch] Got 401, attempting token refresh...
[ProtectedPage] 401 error, logging out...
[PermissionsContext] Failed to load permissions: 401
```

### Check Token Status

Mở browser console và chạy:

```javascript
// Check current session
const session = JSON.parse(localStorage.getItem('kpi_session'));
console.log('Session:', {
  uid: session?.uid,
  email: session?.email,
  expiresAt: new Date(session?.expiresAt).toISOString(),
  timeUntilExpiry: Math.round((session?.expiresAt - Date.now()) / 1000 / 60) + ' minutes',
});
```

## 📋 Testing Checklist

### Test 1: Normal Usage
- [ ] Login với tài khoản
- [ ] Truy cập `/admin`
- [ ] Reload trang nhiều lần
- [ ] Vẫn truy cập được `/admin` ✅

### Test 2: Token Expiry
- [ ] Login với tài khoản
- [ ] Đợi 55 phút (gần hết hạn token)
- [ ] Reload trang
- [ ] Token tự động refresh ✅
- [ ] Vẫn truy cập được `/admin` ✅

### Test 3: Token Invalid
- [ ] Login với tài khoản
- [ ] Mở console, xóa token: `localStorage.removeItem('kpi_session')`
- [ ] Reload trang
- [ ] Tự động redirect về `/login` ✅

### Test 4: API 401 Error
- [ ] Login với tài khoản
- [ ] Truy cập `/admin`
- [ ] Nếu API trả về 401
- [ ] Tự động refresh token và retry ✅
- [ ] Nếu refresh fail → logout ✅

## 🚨 Troubleshooting

### Vấn đề: Vẫn bị redirect về / khi reload

**Nguyên nhân có thể:**
1. Token từ LMS bị invalidate (LMS reset token)
2. Refresh token không còn valid
3. Network error khi refresh token

**Cách debug:**
1. Mở browser console
2. Reload trang
3. Xem logs:
   - Nếu thấy "Token expiring soon, refreshing..." → Token đang được refresh
   - Nếu thấy "Token refresh failed" → Refresh token không valid
   - Nếu thấy "401 error, logging out" → API trả về 401

**Giải pháp:**
- Nếu refresh token fail → Đăng nhập lại
- Nếu LMS reset token → Không có cách nào khác ngoài đăng nhập lại

### Vấn đề: Token refresh quá thường xuyên

**Nguyên nhân:**
- Buffer time 5 phút có thể hơi dài

**Giải pháp:**
- Giảm buffer time xuống 2-3 phút trong `authService.ts`:
```typescript
const bufferTime = 2 * 60 * 1000; // 2 minutes
```

### Vấn đề: Sidebar vẫn hiển thị user info sau khi logout

**Nguyên nhân:**
- AuthContext state chưa được clear

**Giải pháp:**
- Đã fix trong `logout()` function:
```typescript
const logout = useCallback(() => {
  clearSession();
  setSession(null);  // Clear state
  router.push('/login');
}, [router]);
```

## 📊 Token Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ Token Lifecycle                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Login                                                      │
│    ↓                                                        │
│  Get idToken + refreshToken (expires in 1 hour)            │
│    ↓                                                        │
│  Store in localStorage                                      │
│    ↓                                                        │
│  Use idToken for API calls                                 │
│    ↓                                                        │
│  [55 minutes later]                                        │
│    ↓                                                        │
│  Token expiring soon (5 min buffer)                        │
│    ↓                                                        │
│  Auto refresh with refreshToken                            │
│    ↓                                                        │
│  Get new idToken + refreshToken                            │
│    ↓                                                        │
│  Update localStorage                                        │
│    ↓                                                        │
│  Continue using new idToken                                │
│    ↓                                                        │
│  [If refresh fails]                                        │
│    ↓                                                        │
│  Clear session → Logout → Redirect to /login              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Best Practices

### 1. Always use authFetch for authenticated requests
```typescript
// ✅ ĐÚNG
const response = await authFetch('/api/admin/users');

// ❌ SAI
const response = await fetch('/api/admin/users', {
  headers: { Authorization: `Bearer ${token}` }
});
```

### 2. Handle token errors gracefully
```typescript
try {
  const response = await authFetch('/api/admin/users');
  // ...
} catch (error) {
  if (error.message.includes('Session expired')) {
    // User will be auto-logged out
    return;
  }
  // Handle other errors
}
```

### 3. Don't store sensitive data in localStorage
```typescript
// ✅ ĐÚNG - Only store tokens
localStorage.setItem('kpi_session', JSON.stringify({
  idToken,
  refreshToken,
  expiresAt,
  uid,
  email,
}));

// ❌ SAI - Don't store passwords or sensitive data
localStorage.setItem('password', password); // Never do this!
```

## 📚 Related Files

- `src/services/authService.ts` - Token management
- `src/lib/auth/clientAuth.ts` - Authenticated fetch wrapper
- `src/lib/AuthContext.tsx` - Auth state management
- `src/lib/PermissionsContext.tsx` - Permissions loading
- `src/components/ProtectedPage.tsx` - Page-level auth guard

## 🔗 References

- Firebase Auth REST API: https://firebase.google.com/docs/reference/rest/auth
- Token refresh: https://firebase.google.com/docs/reference/rest/auth#section-refresh-token

---

**Last Updated:** 2026-05-07
**Version:** 1.0.0
