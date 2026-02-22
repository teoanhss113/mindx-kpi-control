import React, { useState, useRef, useEffect } from 'react';
import styles from '@/app/dashboard.module.css';

// Inline Spinner component
function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span className={styles.spinner}
      style={{ width: size, height: size, borderColor: 'rgba(0,0,0,0.08)', borderTopColor: 'var(--brand-indigo)', flexShrink: 0 }} />
  );
}

export interface UserSearchResult {
  id: string;
  username?: string;
  displayName?: string;
  email?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
}

interface UserSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (user: UserSearchResult) => void;
  onClear?: () => void;
  results: UserSearchResult[];
  loading: boolean;
  placeholder?: string;
  selectedUserName?: string;
  disabled?: boolean;
  required?: boolean;
  type?: 'text' | 'email';
  showClearButton?: boolean;
}

export function UserSearchInput({
  value,
  onChange,
  onSelect,
  onClear,
  results,
  loading,
  placeholder = 'Tìm kiếm theo tên hoặc email...',
  selectedUserName,
  disabled = false,
  required = false,
  type = 'text',
  showClearButton = true,
}: UserSearchInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type={type}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        placeholder={selectedUserName && !value ? '' : placeholder}
        style={{
          width: '100%',
          padding: '8px 12px',
          paddingRight: selectedUserName && !value && showClearButton ? '32px' : '12px',
          border: '1px solid var(--border-secondary)',
          borderRadius: 'var(--radius-comfortable)',
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          background: disabled ? 'var(--bg-elevated)' : 'var(--bg-surface)',
          color: 'var(--text-primary)',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
        autoComplete="off"
      />

      {/* Current selection display */}
      {selectedUserName && !value && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 12,
            right: showClearButton ? 32 : 12,
            transform: 'translateY(-50%)',
            fontSize: 13,
            color: 'var(--text-primary)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--status-emerald)',
              flexShrink: 0,
            }}
          />
          {selectedUserName}
        </div>
      )}

      {/* Clear button */}
      {selectedUserName && !value && showClearButton && onClear && (
        <button
          onClick={onClear}
          type="button"
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: 'var(--space-1)',
            borderRadius: 'var(--radius-standard)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-elevated)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--text-tertiary)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* Dropdown */}
      {showDropdown && !disabled && (loading || results.length > 0 || (value.length >= 2 && !loading && results.length === 0)) && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 'var(--space-1)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-comfortable)',
            boxShadow: 'var(--shadow-elevated)',
            maxHeight: 240,
            overflowY: 'auto',
            zIndex: 1000,
          }}
        >
          {loading ? (
            <div
              style={{
                padding: 'var(--space-3)',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <Spinner size={14} />
              Đang tìm kiếm...
            </div>
          ) : results.length === 0 && value.length >= 2 ? (
            <div
              style={{
                padding: 'var(--space-3)',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 13,
              }}
            >
              Không tìm thấy kết quả phù hợp
            </div>
          ) : (
            results.map((user) => {
              const displayName = user.displayName || user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
              return (
                <div
                  key={user.id}
                  onMouseDown={() => {
                    onSelect(user);
                    setShowDropdown(false);
                  }}
                  style={{
                    padding: 'var(--space-3)',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-primary)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontWeight: 510, fontSize: 13, marginBottom: 'var(--space-1)' }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {user.email}
                    {user.username && ` • @${user.username}`}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
