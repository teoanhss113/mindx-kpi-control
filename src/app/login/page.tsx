'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/services/authService';
import { persistSession } from '@/services/authService';
import { isAuthenticated, loadSession } from '@/services/authService';
import { useAuth } from '@/lib/AuthContext';
import styles from './login.module.css';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');
  const { updateSession } = useAuth();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // If already authenticated, asynchronously check permissions and redirect smartly
  useEffect(() => {
    if (isAuthenticated()) {
      const session = loadSession();
      if (!session || !session.idToken) {
        router.replace(callbackUrl || '/');
        return;
      }
      
      // Flag that this is a login/restore event for down-stream routing intelligence
      sessionStorage.setItem('mindx_just_logged_in', 'true');

      // Perform a quick check to see if user deserves Admin routing
      fetch('/api/auth/sync-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.idToken}`,
        },
        body: JSON.stringify({
          uid: session.uid,
          email: session.email,
        }),
      })
      .then(res => res.ok ? res.json() : null)
      .then(() => {
        // Decoupled: Always route to target or Home. 
        // The Interceptor on HomePage handles the smart Admin bounce based on actual permissions.
        router.replace(callbackUrl || '/');
      })
      .catch(() => {
        router.replace(callbackUrl || '/');
      });
    }
  }, [router, callbackUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUsername.trim() || !password.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('[Login] Starting login with:', emailOrUsername.includes('@') ? 'email' : 'username');
      
      const session = await signIn(emailOrUsername.trim(), password);
      console.log('[Login] Sign in successful, session:', {
        uid: session.uid,
        email: session.email,
        hasToken: !!session.idToken,
      });
      
      persistSession(session);
      
      // Critical: Set flag BEFORE updating state so next page sees it even if React unmounts this form
      sessionStorage.setItem('mindx_just_logged_in', 'true');
      
      updateSession(session);

      // Sync profile (creates if missing) and learn the user's role.
      let profile: { role_id?: string | null; is_active?: boolean } | null = null;
      try {
        console.log('[Login] Syncing profile...');
        const syncRes = await fetch('/api/auth/sync-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.idToken}`,
          },
          body: JSON.stringify({
            uid: session.uid,
            email: session.email,
            displayName: session.displayName,
          }),
        });
        
        if (syncRes.ok) {
          const json = await syncRes.json();
          profile = json?.profile || null;
          console.log('[Login] Profile synced:', {
            role_id: profile?.role_id,
            is_active: profile?.is_active,
          });
        } else {
          console.error('[Login] Profile sync failed:', syncRes.status);
        }
      } catch (syncError) {
        console.error('[Login] Profile sync error:', syncError);
        // Sync failure → fall through to user view.
      }

      await new Promise((r) => setTimeout(r, 400));

      // Final safety catch: Blindly route to target landing zone.
      // The rock-solid Interceptor logic on the HomePage now definitively handles
      // splitting traffic correctly based on real-time hydrate permissions flawlessly.
      router.replace(callbackUrl || '/');
    } catch (err) {
      console.error('[Login] Login error:', err);
      const msg = err instanceof Error ? err.message : 'Đăng nhập thất bại';
      // Map Firebase error codes to user-friendly messages
      setError(
        msg.includes('INVALID_PASSWORD') || msg.includes('INVALID_LOGIN_CREDENTIALS') || msg.includes('Invalid username or password')
          ? 'Email/Username hoặc mật khẩu không đúng.'
          : msg.includes('TOO_MANY_ATTEMPTS_TRY_LATER')
          ? 'Quá nhiều lần thử. Vui lòng đợi vài phút rồi thử lại.'
          : msg.includes('USER_DISABLED')
          ? 'Tài khoản đã bị vô hiệu hoá.'
          : 'Đăng nhập thất bại. Vui lòng thử lại.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Background glow effects */}
      <div className={styles.bgGlow1} />
      <div className={styles.bgGlow2} />

      <div className={styles.container}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.logoMark}>
            <img src="/logo/logo.svg" alt="MindX" width={36} height={36} style={{ objectFit: 'contain', display: 'block' }} />
          </div>
          <div>
            <div className={styles.brandName}>KPI Control</div>
            <div className={styles.brandSub}>MindX Teacher Control</div>
          </div>
        </div>

        {/* Login Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.title}>Đăng nhập</h1>
            <p className={styles.subtitle}>
              Dùng tài khoản MindX nội bộ để truy cập
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {/* Error message */}
            {error && (
              <div className={styles.errorBanner} role="alert">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 4.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="8" cy="11" r="0.75" fill="currentColor" />
                </svg>
                {error}
              </div>
            )}

            {/* Email/Username field */}
            <div className={styles.field}>
              <label htmlFor="emailOrUsername" className={styles.label}>
                Email hoặc Username
              </label>
              <input
                id="emailOrUsername"
                type="text"
                className={styles.input}
                placeholder="ten@mindx.com.vn hoặc tenpnh"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                disabled={isLoading}
                required
              />
            </div>

            {/* Password field */}
            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>
                Mật khẩu
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              id="btn-login"
              type="submit"
              className={styles.submitButton}
              disabled={isLoading || !emailOrUsername || !password}
            >
              {isLoading ? (
                <span className={styles.spinner} />
              ) : null}
              {isLoading ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>
          </form>
        </div>

        <p className={styles.footer}>
          Hệ thống nội bộ MindX · Chỉ dành cho nhân viên
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-marketing)' }}>
        <div className={styles.spinner} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

// Fixed form validation
// Fixed form validation
// Fixed form validation logic

// Fixed form validation
