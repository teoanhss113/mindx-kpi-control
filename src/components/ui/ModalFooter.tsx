import React from 'react';

export interface ModalFooterButton {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

interface ModalFooterProps {
  /** Primary action button (e.g., Save, Create, Update) */
  primaryButton: ModalFooterButton;
  /** Optional secondary button (e.g., Cancel, Reset) */
  secondaryButton?: ModalFooterButton;
  /** Optional additional buttons (e.g., Approve, Delete) - rendered before primary */
  additionalButtons?: ModalFooterButton[];
}

export function ModalFooter({
  primaryButton,
  secondaryButton,
  additionalButtons = [],
}: ModalFooterProps) {
  const getButtonStyle = (variant: ModalFooterButton['variant'], loading?: boolean, disabled?: boolean) => {
    const baseStyle: React.CSSProperties = {
      fontSize: 13,
      fontWeight: variant === 'primary' || variant === 'danger' || variant === 'success' ? 600 : 510,
      borderRadius: 'var(--radius-comfortable)',
      padding: '7px 16px',
      cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      border: 'none',
      transition: 'all 0.15s ease',
    };

    if (loading || disabled) {
      return {
        ...baseStyle,
        color: 'var(--text-quaternary)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
      };
    }

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          color: 'var(--bg-surface)',
          background: 'var(--brand-indigo)',
          border: 'none',
        };
      case 'danger':
        return {
          ...baseStyle,
          color: 'var(--bg-surface)',
          background: 'var(--brand-maroon, #7d0004)',
          border: 'none',
        };
      case 'success':
        return {
          ...baseStyle,
          color: 'var(--bg-surface)',
          background: 'var(--status-success)',
          border: 'none',
        };
      case 'secondary':
      default:
        return {
          ...baseStyle,
          color: 'var(--text-secondary)',
          background: 'transparent',
          border: '1px solid var(--border-primary)',
        };
    }
  };

  const renderButton = (button: ModalFooterButton, key: string) => {
    const isLoading = button.loading;
    const isDisabled = button.disabled || isLoading;

    return (
      <button
        key={key}
        type={button.type || 'button'}
        onClick={button.onClick}
        disabled={isDisabled}
        style={getButtonStyle(button.variant, isLoading, isDisabled)}
      >
        {isLoading && (
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: button.variant === 'secondary' ? 'var(--brand-indigo)' : 'var(--bg-surface)',
              display: 'inline-block',
              animation: 'spin 0.7s linear infinite',
            }}
          />
        )}
        {isLoading ? button.loadingText || 'Đang xử lý...' : button.label}
      </button>
    );
  };

  return (
    <div
      style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--border-primary)',
        background: 'var(--bg-elevated)',
        display: 'flex',
        gap: 'var(--space-3)',
        justifyContent: 'flex-end',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      {/* Secondary button (Cancel/Reset) - leftmost */}
      {secondaryButton && renderButton(secondaryButton, 'secondary')}

      {/* Additional buttons (Approve, Delete, etc.) - middle */}
      {additionalButtons.map((button, index) => renderButton(button, `additional-${index}`))}

      {/* Primary button (Save/Create/Update) - rightmost */}
      {renderButton(primaryButton, 'primary')}
    </div>
  );
}
// Improved accessibility
