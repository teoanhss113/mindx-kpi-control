/**
 * ErrorBanner Component
 * 
 * Displays an error message banner
 */

import { Icon } from '@/components/ui';

interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      style={{
        padding: 'var(--space-3) var(--space-4)',
        background: 'rgba(220, 38, 38, 0.08)',
        border: '1px solid rgba(220, 38, 38, 0.25)',
        borderRadius: 'var(--radius-comfortable)',
        color: '#dc2626',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
      }}
    >
      <Icon.AlertCircle size={16} />
      {message}
    </div>
  );
}
