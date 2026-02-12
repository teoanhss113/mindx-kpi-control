/**
 * UnderDevelopmentBanner Component
 * 
 * Displays a warning banner for features under development
 */

import { Icon } from '@/components/ui';

export function UnderDevelopmentBanner() {
  return (
    <div style={{
      background: 'var(--status-warning)',
      color: 'white',
      padding: 'var(--space-4)',
      borderRadius: 'var(--radius-card)',
      marginBottom: 'var(--space-4)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      fontSize: 14,
      fontWeight: 510,
    }}>
      <Icon.AlertTriangle size={18} />
      <span>Chức năng này đang được phát triển lại</span>
    </div>
  );
}
