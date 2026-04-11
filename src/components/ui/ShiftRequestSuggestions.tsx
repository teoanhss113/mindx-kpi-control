/**
 * Shift Request Suggestions Component
 * Display teachers who requested to take a shift
 * Used in admin office hours modal
 */

import React from 'react';
import styles from '@/app/dashboard.module.css';

export interface ShiftRequest {
  id: string;
  teacher_id: string | null;
  teacher_name: string | null;
  teacher_email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  request_note?: string | null;
}

interface ShiftRequestSuggestionsProps {
  requests: ShiftRequest[];
  onSelect: (request: ShiftRequest) => void;
}

export function ShiftRequestSuggestions({
  requests,
  onSelect,
}: ShiftRequestSuggestionsProps) {
  if (requests.length === 0) return null;

  return (
    <div style={{ marginTop: 'var(--space-3)' }}>
      {/* Header */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 590,
          color: 'var(--text-quaternary)',
          textTransform: 'uppercase',
          marginBottom: 'var(--space-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        Giáo viên đã yêu cầu ({requests.length})
      </div>

      {/* Suggestions List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          padding: 'var(--space-3)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        {requests.map((request) => {
          // Skip if missing required data
          if (!request.teacher_id || !request.teacher_name) {
            return null;
          }

          return (
            <div
              key={request.id}
              onClick={() => onSelect(request)}
              style={{
                padding: 'var(--space-3)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-comfortable)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-elevated)';
                e.currentTarget.style.borderColor = 'var(--brand-indigo)';
                e.currentTarget.style.transform = 'translateX(2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-surface)';
                e.currentTarget.style.borderColor = 'var(--border-primary)';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              {/* Teacher Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 510,
                    color: 'var(--text-primary)',
                    marginBottom: 'var(--space-1)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {request.teacher_name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {request.teacher_email}
                </div>
                {request.request_note && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      marginTop: 'var(--space-1)',
                      fontStyle: 'italic',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    "{request.request_note}"
                  </div>
                )}
              </div>

              {/* Action Hint */}
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--brand-indigo)',
                  fontWeight: 510,
                  marginLeft: 'var(--space-3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  flexShrink: 0,
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// Improved error messages
