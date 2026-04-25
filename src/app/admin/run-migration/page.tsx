'use client';

import { useState } from 'react';
import { PageLayout } from '@/components/PageLayout';

export default function RunMigrationPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function runMigration() {
    setRunning(true);
    setResult(null);

    try {
      const response = await fetch('/api/run-migration');
      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message,
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <PageLayout title="Run Migration" activePage={undefined}>
      <div style={{ padding: 'var(--space-6)', maxWidth: 800 }}>
        <h2 style={{ fontSize: 20, fontWeight: 590, marginBottom: 'var(--space-4)' }}>
          Database Migration
        </h2>
        
        <p style={{ marginBottom: 'var(--space-4)', color: 'var(--text-secondary)' }}>
          This will create the <code>teacher_office_hour_confirmations</code> table.
        </p>

        <button
          onClick={runMigration}
          disabled={running}
          style={{
            padding: 'var(--space-3) var(--space-5)',
            background: running ? 'var(--bg-panel)' : 'var(--brand-indigo)',
            color: running ? 'var(--text-tertiary)' : 'white',
            border: 'none',
            borderRadius: 'var(--radius-comfortable)',
            fontSize: 14,
            fontWeight: 510,
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? 'Running...' : 'Run Migration'}
        </button>

        {result && (
          <div style={{
            marginTop: 'var(--space-6)',
            padding: 'var(--space-4)',
            background: result.success ? '#d1fae5' : '#fee2e2',
            border: `1px solid ${result.success ? '#6ee7b7' : '#fecaca'}`,
            borderRadius: 'var(--radius-comfortable)',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 590, marginBottom: 'var(--space-3)' }}>
              {result.success ? '✅ Success' : '❌ Failed'}
            </h3>
            
            <p style={{ marginBottom: 'var(--space-2)' }}>
              {result.message}
            </p>

            {result.tableExists !== undefined && (
              <p style={{ marginBottom: 'var(--space-2)' }}>
                Table exists: {result.tableExists ? 'Yes' : 'No'}
              </p>
            )}

            {result.error && (
              <pre style={{
                marginTop: 'var(--space-3)',
                padding: 'var(--space-3)',
                background: 'rgba(0,0,0,0.05)',
                borderRadius: 'var(--radius-comfortable)',
                fontSize: 12,
                overflow: 'auto',
              }}>
                {result.error}
              </pre>
            )}

            {result.results && (
              <details style={{ marginTop: 'var(--space-3)' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 510 }}>
                  View Details ({result.results.length} statements)
                </summary>
                <div style={{ marginTop: 'var(--space-2)' }}>
                  {result.results.map((r: any, i: number) => (
                    <div key={i} style={{
                      padding: 'var(--space-2)',
                      marginBottom: 'var(--space-2)',
                      background: 'rgba(0,0,0,0.03)',
                      borderRadius: 'var(--radius-comfortable)',
                      fontSize: 12,
                    }}>
                      <div>
                        {r.success ? '✅' : '❌'} Statement {r.index}
                      </div>
                      {r.error && (
                        <div style={{ color: '#dc2626', marginTop: 4 }}>
                          {r.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        <div style={{
          marginTop: 'var(--space-6)',
          padding: 'var(--space-4)',
          background: 'var(--bg-panel)',
          borderRadius: 'var(--radius-comfortable)',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 590, marginBottom: 'var(--space-2)' }}>
            Manual Alternative
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
            If the automatic migration fails, you can run it manually:
          </p>
          <ol style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 'var(--space-5)' }}>
            <li>Go to <a href="https://supabase.com/dashboard/project/rhytobkuyqcxgnlpeqss/sql" target="_blank" style={{ color: 'var(--brand-indigo)' }}>Supabase SQL Editor</a></li>
            <li>Copy content from: <code>supabase/migrations/011_office_hours_teacher_confirmation.sql</code></li>
            <li>Paste and click "Run"</li>
          </ol>
        </div>
      </div>
    </PageLayout>
  );
}
