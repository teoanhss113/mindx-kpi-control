'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { authFetch } from '@/lib/auth/clientAuth';

export default function DebugPermissionsPage() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [role, setRole] = useState<any>(null);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  useEffect(() => {
    if (session?.uid) {
      loadData();
    }
  }, [session?.uid]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      if (!session?.uid) {
        setError('Not logged in');
        setLoading(false);
        return;
      }

      const res = await authFetch(
        `/api/auth/sync-user?uid=${encodeURIComponent(session.uid)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(`Profile Error: ${body?.error || res.statusText}`);
        setLoading(false);
        return;
      }
      const json = await res.json();
      const profileData = json?.data?.profile;
      setProfile(profileData);

      if (!profileData?.is_active) {
        setError('User account is inactive');
        setLoading(false);
        return;
      }
      if (!profileData?.role_id) {
        setError('User has no role_id assigned');
        setLoading(false);
        return;
      }

      setRole(profileData?.roles || null);
      setPermissions(profileData?.roles?.role_permissions || []);
      setLoading(false);
    } catch (err: any) {
      setError(`Exception: ${err.message}`);
      setLoading(false);
    }
  }

  async function syncProfile() {
    if (!session?.uid || !session?.email) {
      alert('No session found');
      return;
    }

    try {
      setSyncing(true);
      setSyncResult(null);

      const response = await authFetch('/api/auth/sync-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: session.uid,
          email: session.email,
          displayName: session.displayName,
        }),
      });

      const result = await response.json();
      setSyncResult(result);

      if (result.success) {
        // Reload data after sync
        await loadData();
      }

      setSyncing(false);
    } catch (err: any) {
      setSyncResult({ error: err.message });
      setSyncing(false);
    }
  }

  if (!session) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Debug Permissions</h1>
        <p>Not logged in. Please login first.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, fontFamily: 'monospace', fontSize: 13 }}>
      <h1 style={{ marginBottom: 20 }}>🔍 Debug Permissions</h1>

      {loading && <p>Loading...</p>}

      {error && (
        <div style={{ 
          padding: 16, 
          background: '#fee', 
          border: '1px solid #fcc',
          borderRadius: 8,
          marginBottom: 20,
          color: '#c00'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ marginBottom: 30 }}>
        <h2>Session Info</h2>
        <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto' }}>
          {JSON.stringify({
            uid: session.uid,
            email: session.email,
            displayName: session.displayName,
          }, null, 2)}
        </pre>
      </div>

      {profile && (
        <div style={{ marginBottom: 30 }}>
          <h2>Profile</h2>
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto' }}>
            {JSON.stringify(profile, null, 2)}
          </pre>
        </div>
      )}

      {role && (
        <div style={{ marginBottom: 30 }}>
          <h2>Role</h2>
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto' }}>
            {JSON.stringify(role, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginBottom: 30 }}>
        <h2>Permissions ({permissions.length})</h2>
        {permissions.length === 0 ? (
          <p style={{ color: '#c00' }}>⚠️ No permissions found!</p>
        ) : (
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            background: '#f5f5f5',
            borderRadius: 8,
            overflow: 'hidden'
          }}>
            <thead>
              <tr style={{ background: '#e0e0e0' }}>
                <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #ccc' }}>Page Key</th>
                <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #ccc' }}>Page Name</th>
                <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ccc' }}>Can View</th>
                <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #ccc' }}>Can Edit</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((perm: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: 12 }}>{perm.pages?.key || 'N/A'}</td>
                  <td style={{ padding: 12 }}>{perm.pages?.page_name || 'N/A'}</td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    {perm.can_view ? '✅' : '❌'}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    {perm.can_edit ? '✅' : '❌'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 40, padding: 16, background: '#e8f4f8', borderRadius: 8 }}>
        <h3>Quick Checks</h3>
        <ul>
          <li>✅ Logged in: {session ? 'Yes' : 'No'}</li>
          <li>✅ Has Profile: {profile ? 'Yes' : 'No'}</li>
          <li>✅ Has Role ID: {profile?.role_id ? 'Yes' : 'No'}</li>
          <li>✅ Role Loaded: {role ? 'Yes' : 'No'}</li>
          <li>✅ Permissions Count: {permissions.length}</li>
          <li>✅ Can View Dashboard: {permissions.some(p => p.pages?.key === 'dashboard' && p.can_view) ? 'Yes' : 'No'}</li>
        </ul>
      </div>

      <div style={{ marginTop: 20 }}>
        <button 
          onClick={syncProfile}
          disabled={syncing}
          style={{
            padding: '12px 24px',
            background: syncing ? '#ccc' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: syncing ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 600,
            marginRight: 12
          }}
        >
          {syncing ? '⏳ Syncing...' : '🔄 Sync Profile from Firebase'}
        </button>
        
        <button 
          onClick={loadData}
          style={{
            padding: '12px 24px',
            background: '#5e6ad2',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600
          }}
        >
          🔄 Reload Data
        </button>
      </div>

      {syncResult && (
        <div style={{ 
          marginTop: 20,
          padding: 16, 
          background: syncResult.success ? '#d1fae5' : '#fee', 
          border: `1px solid ${syncResult.success ? '#6ee7b7' : '#fcc'}`,
          borderRadius: 8,
          color: syncResult.success ? '#065f46' : '#c00'
        }}>
          <strong>Sync Result:</strong>
          <pre style={{ marginTop: 8, fontSize: 12 }}>
            {JSON.stringify(syncResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
