'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui';
import { useNotifications } from '@/hooks/useNotifications';
import { authFetch } from '@/lib/auth/clientAuth';
import styles from './NotificationSettings.module.css';

export function NotificationSettings() {
  const { supported, permission, subscribed, loading, error, subscribe, unsubscribe, clearError } =
    useNotifications();

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);

  const handleToggle = async () => {
    if (subscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await authFetch('/api/notifications/test', { method: 'POST' });
      const data = await res.json();
      setTestResult(data.success ? 'ok' : 'fail');
    } catch {
      setTestResult('fail');
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const handleResubscribe = async () => {
    setTestResult(null);
    await subscribe();
  };

  if (!supported) {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && (navigator as any).maxTouchPoints > 1);
    const isIOSSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    const isStandalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);

    let message = 'Trình duyệt của bạn không hỗ trợ push notifications';
    if (isIOS && !isIOSSafari) {
      message = 'Trên iPhone/iPad, push notifications chỉ hoạt động trong Safari. Vui lòng mở trang này bằng Safari, sau đó nhấn nút Chia sẻ → "Thêm vào màn hình chính" để bật thông báo.';
    } else if (isIOSSafari && !isStandalone) {
      message = 'Để bật push notifications trên iOS, hãy nhấn nút Chia sẻ → "Thêm vào màn hình chính", sau đó mở ứng dụng từ màn hình chính.';
    }

    return (
      <div className={styles.container}>
        <div className={styles.unsupported}>
          <Icon.BellOff size={24} />
          <p>{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <Icon.Bell size={20} />
        </div>
        <div className={styles.headerText}>
          <h3>Thông báo đẩy</h3>
          <p>Nhận thông báo khi có yêu cầu và cập nhật quan trọng</p>
        </div>
        <span className={`${styles.statusBadge} ${styles[permission]}`}>
          {permission === 'granted' ? 'Đã cho phép' : permission === 'denied' ? 'Đã từ chối' : 'Chưa thiết lập'}
        </span>
      </div>

      <div className={styles.content}>
        {permission === 'denied' ? (
          <p className={styles.helpText}>
            Bạn đã từ chối quyền thông báo. Vào cài đặt trình duyệt để bật lại cho trang này.
          </p>
        ) : (
          <div className={styles.row}>
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={subscribed}
                onChange={handleToggle}
                disabled={loading}
                className={styles.toggleInput}
              />
              <span className={styles.toggleSwitch} />
              <span className={styles.toggleText}>
                {subscribed ? 'Đang bật' : 'Đang tắt'}
              </span>
            </label>

            {subscribed && permission === 'granted' && (
              testResult === 'fail' ? (
                <button onClick={handleResubscribe} className={styles.resubscribeBtn}>
                  Đăng ký lại
                </button>
              ) : (
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className={styles.testButton}
                  style={testResult === 'ok' ? { color: '#10b981' } : undefined}
                >
                  {testing ? '...' : testResult === 'ok' ? '✓ Đã gửi' : 'Gửi thử'}
                </button>
              )
            )}
          </div>
        )}

        {permission === 'default' && (
          <p className={styles.helpText}>
            Bật thông báo để nhận cập nhật về xác nhận, phê duyệt ca và các thay đổi quan trọng.
          </p>
        )}

        {error && (
          <div className={styles.error}>
            <span>{error}</span>
            <button onClick={clearError} className={styles.errorClose}>✕</button>
          </div>
        )}
      </div>
    </div>
  );
}
