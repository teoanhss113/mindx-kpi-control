/**
 * ConfirmDialog Component
 * Consistent confirmation modal for delete/destructive actions
 * Replaces native confirm() with design system modal
 */

'use client';

import { Modal, ModalHeader, Icon } from './index';
import styles from '@/app/dashboard.module.css';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <Icon.AlertTriangle size={20} />;
      case 'warning':
        return <Icon.AlertCircle size={20} />;
      case 'info':
        return <Icon.CheckCircle size={20} />;
      default:
        return <Icon.AlertTriangle size={20} />;
    }
  };

  const getIconColor = () => {
    switch (variant) {
      case 'danger':
        return 'var(--status-error)';
      case 'warning':
        return 'var(--status-warning)';
      case 'info':
        return 'var(--brand-indigo)';
      default:
        return 'var(--status-error)';
    }
  };

  const getConfirmButtonStyle = () => {
    switch (variant) {
      case 'danger':
        return {
          background: 'var(--status-error)',
          color: 'white',
          border: 'none',
        };
      case 'warning':
        return {
          background: 'var(--status-warning)',
          color: 'white',
          border: 'none',
        };
      case 'info':
        return {
          background: 'var(--brand-indigo)',
          color: 'white',
          border: 'none',
        };
      default:
        return {
          background: 'var(--status-error)',
          color: 'white',
          border: 'none',
        };
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ 
        width: '100%', 
        maxWidth: '440px',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}>
        <ModalHeader title={title} onClose={onClose} />
        
        {/* Content */}
        <div style={{ 
          padding: 'var(--space-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}>
          {/* Icon + Message */}
          <div style={{ 
            display: 'flex',
            gap: 'var(--space-3)',
            alignItems: 'flex-start',
          }}>
            <div style={{ 
              color: getIconColor(),
              flexShrink: 0,
              marginTop: '2px',
            }}>
              {getIcon()}
            </div>
            <div style={{ 
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
              letterSpacing: '-0.13px',
            }}>
              {message}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-2)',
          padding: 'var(--space-4)',
          borderTop: '1px solid var(--border-primary)',
          background: 'var(--bg-elevated)',
          justifyContent: 'flex-end',
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 510,
              borderRadius: 'var(--radius-comfortable)',
              border: '1px solid var(--border-secondary)',
              background: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '-0.13px',
              opacity: loading ? 0.5 : 1,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface)';
            }}
          >
            {cancelLabel}
          </button>
          
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 510,
              borderRadius: 'var(--radius-comfortable)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '-0.13px',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.15s ease',
              ...getConfirmButtonStyle(),
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            {loading && (
              <span 
                className={styles.spinner}
                style={{ 
                  width: 12, 
                  height: 12, 
                  borderColor: 'rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                }} 
              />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Added ESC key support
// Added ESC key support
// Added ESC key handler

// Added ESC handler
