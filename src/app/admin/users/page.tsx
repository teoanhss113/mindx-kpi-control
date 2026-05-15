'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { getUsers, getUnmanagedUsers, createUser, updateUser, deleteUser, getUserRoles } from '@/lib/admin-actions';
import { getAuthToken } from '@/lib/auth/clientAuth';
import { findUser, createDebouncedUserLookup, type LMSUser } from '@/services/userLookupService';
import { searchUsers } from '@/services/ticketService';
import { AdminPageWrapper } from '@/components/AdminPageWrapper';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader, AdminToolbar, AdminTableSection, Icon, Spinner, MultiSelect, EmptyState, UserSearchInput, type UserSearchResult, ModalFooter, Modal, ModalHeader, ConfirmDialog, useToast, ToastContainer, ActiveStatusBadge, CompactSelect, TableActionButton, TableActionGroup, Badge } from '@/components/ui';
import { COURSES, LABELS, MESSAGES, ENTITIES, SYSTEM_ADMIN_LABELS } from '@/constants';
import styles from '@/app/dashboard.module.css';
import type { Role } from '@/lib/supabase/types';

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer'; // Legacy field
  role_id: string | null; // New role system
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  // Enriched from LMS (not in database)
  username?: string;
  full_name?: string;
  // Role info (joined from roles table)
  roles?: Role | null;
}

function formatActivityTime(value?: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [unmanagedUsers, setUnmanagedUsers] = useState<any[]>([]);
  const [showUnmanagedTable, setShowUnmanagedTable] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTable, setShowTable] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Confirm dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast notifications
  const { toasts, addToast, removeToast } = useToast();

  // Auto-fill states
  const [lookupLoading, setLookupLoading] = useState(false);
  const [foundUser, setFoundUser] = useState<LMSUser | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);
  
  // User search dropdown states
  const [userSearchResults, setUserSearchResults] = useState<LMSUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state - email, role_id, is_active + permissions
  const [formData, setFormData] = useState({
    email: '',
    role_id: '', // Changed to role_id
    is_active: true,
    // Permissions
    selectedRegions: [] as string[],
    courses: [] as string[],
    can_view: true,
    can_edit: false,
    can_manage: false,
  });

  // Display data from LMS (not saved to database)
  const [displayData, setDisplayData] = useState({
    username: '',
    full_name: '',
  });

  // Debounced user lookup
  const debouncedLookup = useCallback(
    createDebouncedUserLookup(async (user) => {
      setLookupLoading(false);
      setFoundUser(user);
      
      if (user && !editingUser) {
        // Auto-fill email (saved to database)
        setFormData(prev => ({
          ...prev,
          email: user.email || prev.email,
        }));
        
        // Set display data (not saved to database)
        setDisplayData({
          username: user.username || '',
          full_name: user.fullName || user.displayName || '',
        });
        
        setAutoFilled(true);
      }
    }, 500),
    [editingUser]
  );

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const [usersResult, unmanagedResult, rolesResult, regionsResult] = await Promise.all([
        getUsers(token),
        getUnmanagedUsers(token),
        getUserRoles(token),
        (async () => {
          const { getRegions } = await import('@/lib/admin-actions');
          return getRegions(token);
        })()
      ]);

      if (usersResult.success) {
        console.log('Loaded users from database:', usersResult.data);
        
        // Enrich on client-side (has access to session)
        const { enrichProfiles } = await import('@/services/userEnrichmentService');
        const enrichedUsers = await enrichProfiles(usersResult.data as any);
        
        console.log('Enriched users:', enrichedUsers);
        
        // Debug: Check enrichment results
        enrichedUsers.forEach((user: any) => {
          console.log(`User ${user.email}:`, {
            full_name: user.full_name || '(empty)',
            username: user.username || '(empty)',
            lms_data: user.lms_data ? 'found' : 'not found'
          });
        });
        
        setUsers(enrichedUsers as any);
      } else {
        console.error('Failed to load users:', usersResult.error);
        setUsers([]);
      }

      if (unmanagedResult.success) {
        setUnmanagedUsers(unmanagedResult.data);
      }

      if (rolesResult.success) {
        setRoles(rolesResult.data);
      } else {
        console.error('Failed to load roles:', rolesResult.error);
        setRoles([]);
      }

      if (regionsResult.success) {
        setRegions(regionsResult.data);
      } else {
        console.error('Failed to load regions:', regionsResult.error);
        setRegions([]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingUser(null);
    setFormData({
      email: '',
      role_id: roles.find(r => r.name === 'Viewer')?.id || '', // Default to Viewer role
      is_active: true,
      selectedRegions: [],
      courses: [],
      can_view: true,
      can_edit: false,
      can_manage: false,
    });
    setDisplayData({
      username: '',
      full_name: '',
    });
    setFoundUser(null);
    setAutoFilled(false);
    setLookupLoading(false);
    setShowModal(true);
  }

  async function openEditModal(user: Profile) {
    setEditingUser(user);

    const token = await getAuthToken();
    const { getUserPermissionsByUserId } = await import('@/lib/admin-actions');
    const permsResult = await getUserPermissionsByUserId(token, user.id);
    
    const userPermissions = permsResult.success ? permsResult.data : [];
    
    setFormData({
      email: user.email,
      role_id: user.role_id || roles.find(r => r.name === user.role)?.id || '', // Fallback to legacy role
      is_active: user.is_active,
      selectedRegions: userPermissions.map((p: any) => p.region_id),
      courses: userPermissions[0]?.courses || [],
      can_view: userPermissions[0]?.can_view ?? true,
      can_edit: userPermissions[0]?.can_edit ?? false,
      can_manage: userPermissions[0]?.can_manage ?? false,
    });
    setDisplayData({
      username: user.username || '',
      full_name: user.full_name || '',
    });
    setFoundUser(null);
    setAutoFilled(false);
    setLookupLoading(false);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSubmitting(true);
    const loadingToastId = addToast('Đang lưu...', 'loading');

    try {
      const token = await getAuthToken();
      let result;
      let userId: string;

      if (editingUser) {
        result = await updateUser(token, {
          id: editingUser.id,
          email: formData.email.trim().toLowerCase(),
          role_id: formData.role_id,
          is_active: formData.is_active,
        });
        userId = editingUser.id;
      } else {
        const normalizedEmail = formData.email.trim().toLowerCase();
        const createResult = await createUser(token, {
          email: normalizedEmail,
          role_id: formData.role_id,
          is_active: formData.is_active,
        });

        if (!createResult.success) {
          removeToast(loadingToastId);
          addToast('Lỗi: ' + createResult.error, 'error');
          setSubmitting(false);
          return;
        }

        const profileId = createResult.data?.id;
        if (!profileId) {
          removeToast(loadingToastId);
          addToast('Lỗi: Không tìm thấy user vừa tạo', 'error');
          setSubmitting(false);
          return;
        }
        userId = profileId;
        result = createResult;
      }

      if (result.success) {
        // Save permissions if any regions selected
        if (formData.selectedRegions.length > 0) {
          const { saveUserPermissions } = await import('@/lib/admin-actions');
          const permissionsResult = await saveUserPermissions(
            token,
            userId,
            formData.selectedRegions.map(regionId => ({
              region_id: regionId,
              courses: formData.courses,
              can_view: formData.can_view,
              can_edit: formData.can_edit,
              can_manage: formData.can_manage,
            }))
          );
          
          if (!permissionsResult.success) {
            removeToast(loadingToastId);
            addToast('Cảnh báo: Lưu phân quyền thất bại - ' + permissionsResult.error, 'error');
            setSubmitting(false);
            return;
          }
        }
        
        removeToast(loadingToastId);
        addToast(editingUser ? 'Cập nhật phân quyền thành công' : 'Cấp quyền thành công', 'success');
        setShowModal(false);
        loadData();
      } else {
        removeToast(loadingToastId);
        addToast('Lỗi: ' + result.error, 'error');
      }
    } catch (error: any) {
      removeToast(loadingToastId);
      addToast('Lỗi: ' + error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(user: Profile) {
    setUserToDelete(user);
    setShowConfirmDialog(true);
  }

  async function confirmDelete() {
    if (!userToDelete) return;

    setDeleting(true);
    const loadingToastId = addToast('Đang thu hồi quyền...', 'loading');

    try {
      const token = await getAuthToken();
      const result = await deleteUser(token, userToDelete.id);
      removeToast(loadingToastId);
      
      if (result.success) {
        addToast('Đã thu hồi quyền thành công', 'success');
        setShowConfirmDialog(false);
        setUserToDelete(null);
        loadData();
      } else {
        addToast('Lỗi: ' + result.error, 'error');
      }
    } catch (error: any) {
      removeToast(loadingToastId);
      addToast('Lỗi: ' + error.message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  // Handle email/username change với auto-fill
  function handleEmailChange(value: string) {
    setFormData({ ...formData, email: value });
    
    if (!editingUser && value.length >= 2) {
      setLookupLoading(true);
      setAutoFilled(false);
      debouncedLookup(value);
    } else {
      setFoundUser(null);
      setAutoFilled(false);
    }
  }

  function handleUsernameChange(value: string) {
    setDisplayData({ ...displayData, username: value });
    
    if (!editingUser && value.length >= 2 && !value.includes('@')) {
      setLookupLoading(true);
      setAutoFilled(false);
      debouncedLookup(value);
    } else if (!value.includes('@')) {
      setFoundUser(null);
      setAutoFilled(false);
    }
  }
  
  // User search dropdown handler
  const handleUserSearch = useCallback((query: string) => {
    setFormData({ ...formData, email: query });
    setShowUserDropdown(true);
    
    if (userSearchTimerRef.current) {
      clearTimeout(userSearchTimerRef.current);
    }
    
    if (query.length < 2) {
      setUserSearchResults([]);
      return;
    }
    
    userSearchTimerRef.current = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const res = await searchUsers(query);
        setUserSearchResults(res.data);
      } catch (error) {
        console.error('Error searching users:', error);
        setUserSearchResults([]);
      } finally {
        setUserSearchLoading(false);
      }
    }, 400);
  }, [formData]);
  
  // Select user from dropdown
  function selectUserFromDropdown(user: LMSUser) {
    setFormData({ ...formData, email: user.email });
    setDisplayData({
      username: user.username || '',
      full_name: user.fullName || user.displayName || '',
    });
    setFoundUser(user);
    setAutoFilled(true);
    setShowUserDropdown(false);
    setUserSearchResults([]);
  }

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  type UserSortKey = keyof Profile;

  const { sortedData, sortBy, sortOrder, handleSort } = useTableSort<Profile, UserSortKey>({
    data: filteredUsers,
    defaultSortKey: 'created_at' as UserSortKey,
    defaultSortOrder: 'desc'
  });

  return (
    <ProtectedPage pageKey="admin-users">
      <AdminPageWrapper title={SYSTEM_ADMIN_LABELS.USERS_TITLE} activePage="admin-users">
        {/* Toolbar */}
        <AdminToolbar
          search={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Tìm theo email, tên..."
          actionLabel="Cấp quyền"
          onAction={openCreateModal}
          actionIcon={<Icon.Plus />}
        />

      {/* Users Table */}
      {!loading && filteredUsers.length > 0 && (
        <AdminTableSection
          title="Danh sách tài khoản có quyền"
          count={filteredUsers.length}
          loading={loading}
          isExpanded={showTable}
          onToggle={() => setShowTable(!showTable)}
        >
          <div className={styles.tableScrollWrapper}>
            <table className={styles.studentTable}>
              <thead>
                <tr>
                  <SortableHeader label="Email" sortKey="email" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as UserSortKey)} />
                  <SortableHeader label="Tên" sortKey="full_name" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as UserSortKey)} />
                  <SortableHeader label="Username" sortKey="username" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as UserSortKey)} />
                  <SortableHeader label="Vai trò" sortKey="role" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as UserSortKey)} />
                  <SortableHeader label="Trạng thái" sortKey="is_active" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as UserSortKey)} />
                  <SortableHeader label="Hoạt động lần cuối" sortKey="last_login_at" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as UserSortKey)} />
                  <SortableHeader label="Ngày tạo" sortKey="created_at" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as UserSortKey)} />
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((user) => (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 510 }}>{user.email}</td>
                    <td style={{ textTransform: 'capitalize' }}>{user.full_name || '—'}</td>
                    <td style={{ color: 'var(--text-tertiary)' }}>{user.username || '—'}</td>
                    <td>
                      <Badge variant="default" size="sm" shape="rounded">
                        {user.roles?.name || (user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Manager' : 'Viewer')}
                      </Badge>
                    </td>
                    <td>
                      <ActiveStatusBadge active={user.is_active} />
                    </td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 13, whiteSpace: 'nowrap' }}>
                      {formatActivityTime(user.last_login_at)}
                    </td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                      {new Date(user.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td>
                      <TableActionGroup>
                        <TableActionButton label="Chỉnh sửa" icon={<Icon.Edit />} onClick={() => openEditModal(user)} />
                        <TableActionButton label="Xoá" icon={<Icon.Trash />} onClick={() => handleDelete(user)} variant="danger" />
                      </TableActionGroup>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminTableSection>
      )}

      {/* Empty State */}
      {!loading && filteredUsers.length === 0 && (
        <EmptyState
          icon={<Icon.Users size={32} />}
          title={searchTerm ? 'Không tìm thấy tài khoản' : 'Chưa có tài khoản nào'}
          subtitle={searchTerm ? 'Thử tìm kiếm với từ khoá khác' : `${LABELS.CREATE} ${ENTITIES.USERS} đầu tiên để bắt đầu`}
        />
      )}

      {/* Unmanaged Users Table */}
      {!loading && unmanagedUsers.length > 0 && (
        <div style={{ marginTop: 'var(--space-6)' }}>
        <AdminTableSection
          title="Tài khoản chưa được cấp quyền"
          count={unmanagedUsers.length}
          loading={loading}
          isExpanded={showUnmanagedTable}
          onToggle={() => setShowUnmanagedTable(!showUnmanagedTable)}
        >
          <div className={styles.tableScrollWrapper}>
            <table className={styles.studentTable}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Trạng thái</th>
                  <th>Hoạt động lần cuối</th>
                  <th>Ngày tạo</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {unmanagedUsers.map((user) => (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 510 }}>{user.email}</td>
                    <td>
                      <ActiveStatusBadge active={user.is_active} />
                    </td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                      {formatActivityTime(user.last_login_at)}
                    </td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                      {new Date(user.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td>
                      <TableActionGroup>
                        <TableActionButton label="Gán vai trò" icon={<Icon.Edit />} onClick={() => openEditModal(user as Profile)} />
                      </TableActionGroup>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminTableSection>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal open={showModal} onClose={() => setShowModal(false)}>
          <ModalHeader
            title={editingUser ? 'Cập nhật phân quyền' : 'Cấp quyền cho tài khoản'}
            subtitle={editingUser ? `Cập nhật vai trò và quyền truy cập của ${editingUser.email}` : 'Tìm tài khoản và phân vai trò, khu vực truy cập'}
            onClose={() => setShowModal(false)}
          />

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(90vh - 140px)' }}>
            {/* Scrollable content area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Auto-fill status */}
              {!editingUser && (foundUser || lookupLoading) && (
                <div style={{ 
                  padding: 'var(--space-3) var(--space-4)', 
                  background: foundUser ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)', 
                  border: `1px solid ${foundUser ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
                  borderRadius: 'var(--radius-comfortable)',
                  color: foundUser ? '#059669' : '#2563eb',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)'
                }}>
                  {lookupLoading ? (
                    <>
                      <Spinner size={14} />
                      Đang tìm kiếm thông tin từ LMS...
                    </>
                  ) : foundUser ? (
                    <>
                      <Icon.CheckCircle size={16} />
                      Đã tìm thấy và điền thông tin từ LMS
                    </>
                  ) : null}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                  Email *
                </label>
                <UserSearchInput
                  value={formData.email}
                  onChange={handleUserSearch}
                  onSelect={(user) => selectUserFromDropdown(user as LMSUser)}
                  results={userSearchResults as any}
                  loading={userSearchLoading}
                  placeholder="Nhập email hoặc tên để tìm kiếm..."
                  disabled={!!editingUser || (autoFilled && !!foundUser)}
                  required={true}
                  type="email"
                  showClearButton={false}
                />
                {!editingUser && (
                  <p style={{ fontSize: 13, color: 'var(--text-quaternary)', marginTop: 'var(--space-1)' }}>
                    {foundUser ? 'Thông tin từ LMS - Email dùng để đăng nhập' : 'Nhập email hoặc tên để tìm kiếm và chọn từ danh sách'}
                  </p>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                  Tên đầy đủ
                </label>
                <input
                  type="text"
                  disabled={true}
                  value={displayData.full_name}
                  onChange={(e) => setDisplayData({ ...displayData, full_name: e.target.value })}
                  placeholder="Sẽ tự động lấy từ LMS"
                  className={styles.dateInput}
                  style={{ 
                    width: '100%',
                    backgroundColor: 'var(--bg-elevated)',
                    textTransform: 'capitalize'
                  }}
                />
                <p style={{ fontSize: 13, color: 'var(--text-quaternary)', marginTop: 'var(--space-1)' }}>
                  {displayData.full_name ? 'Thông tin từ LMS (chỉ hiển thị, không lưu database)' : 'Nhập email để tự động lấy từ LMS'}
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                  Username
                </label>
                <input
                  type="text"
                  disabled={true}
                  value={displayData.username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="Sẽ tự động lấy từ LMS"
                  className={styles.dateInput}
                  style={{ 
                    width: '100%',
                    backgroundColor: 'var(--bg-elevated)'
                  }}
                />
                <p style={{ fontSize: 13, color: 'var(--text-quaternary)', marginTop: 'var(--space-1)' }}>
                  {displayData.username ? 'Thông tin từ LMS (chỉ hiển thị, không lưu database)' : 'Nhập email để tự động lấy từ LMS'}
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                  Vai trò *
                </label>
                <CompactSelect
                  value={formData.role_id}
                  options={[
                    { value: '', label: 'Chọn vai trò' },
                    ...roles.map(role => ({
                      value: role.id,
                      label: `${role.name} - ${role.description || 'Không có mô tả'}`
                    }))
                  ]}
                  onChange={v => setFormData({ ...formData, role_id: v })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className={styles.reasonCheckbox}
                />
                <label htmlFor="is_active" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Tài khoản hoạt động
                </label>
              </div>

              {/* Permissions Section */}
              <div style={{ 
                marginTop: 'var(--space-4)', 
                paddingTop: 'var(--space-4)', 
                borderTop: '1px solid var(--border-primary)' 
              }}>
                <h4 style={{ 
                  margin: 0, 
                  marginBottom: 'var(--space-3)', 
                  fontSize: 14, 
                  fontWeight: 590,
                  color: 'var(--text-primary)'
                }}>
                  Phân quyền truy cập
                </h4>

                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                    Khu vực được phép truy cập
                  </label>
                  <MultiSelect menuPosition="fixed"
                    options={regions.map(r => ({ value: r.id, label: r.name }))}
                    selected={formData.selectedRegions}
                    onChange={(values) => setFormData({ ...formData, selectedRegions: values })}
                    placeholder="Chọn khu vực (để trống = tất cả)"
                    maxDisplay={2}
                    searchable
                  />
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                    Nếu không chọn khu vực nào, user sẽ có quyền truy cập tất cả khu vực
                  </p>
                </div>

                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                    Khoá học
                  </label>
                  <MultiSelect menuPosition="fixed"
                    options={COURSES.map(course => ({ value: course, label: course }))}
                    selected={formData.courses}
                    onChange={(values) => setFormData({ ...formData, courses: values })}
                    placeholder="Chọn khoá học (để trống = tất cả)"
                    maxDisplay={3}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.can_view}
                      onChange={(e) => setFormData({ ...formData, can_view: e.target.checked })}
                      className={styles.reasonCheckbox}
                    />
                    Xem dữ liệu
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.can_edit}
                      onChange={(e) => setFormData({ ...formData, can_edit: e.target.checked })}
                      className={styles.reasonCheckbox}
                    />
                    Chỉnh sửa dữ liệu
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.can_manage}
                      onChange={(e) => setFormData({ ...formData, can_manage: e.target.checked })}
                      className={styles.reasonCheckbox}
                    />
                    Quản lý (tạo/xoá)
                  </label>
                </div>
              </div>

              {/* Clear auto-fill button */}
              {!editingUser && autoFilled && foundUser && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-2)' }}>
                  <button
                    type="button"
                    className={styles.clearCacheBtn}
                    onClick={() => {
                      setAutoFilled(false);
                      setFoundUser(null);
                      setFormData(prev => ({
                        ...prev,
                        email: '',
                      }));
                      setDisplayData({
                        username: '',
                        full_name: '',
                      });
                    }}
                    style={{ fontSize: 13, padding: 'var(--space-1) var(--space-3)' }}
                  >
                    <Icon.XCircle size={14} />
                    Xoá thông tin tự động và nhập thủ công
                  </button>
                </div>
              )}
            </div>

            {/* Fixed footer outside scrollable area */}
            <ModalFooter
              secondaryButton={{
                label: 'Huỷ',
                onClick: () => setShowModal(false),
                variant: 'secondary',
                disabled: submitting,
              }}
              primaryButton={{
                label: editingUser ? 'Cập nhật quyền' : 'Cấp quyền',
                onClick: () => {}, // Form submit handles this
                variant: 'primary',
                loading: submitting,
                loadingText: editingUser ? 'Đang cập nhật...' : 'Đang cấp quyền...',
                type: 'submit',
              }}
            />
          </form>
        </Modal>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={showConfirmDialog}
        onClose={() => {
          setShowConfirmDialog(false);
          setUserToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Xác nhận thu hồi quyền"
        message={`Bạn có chắc muốn thu hồi toàn bộ quyền của "${userToDelete?.email}"? Tài khoản sẽ bị vô hiệu hoá và chuyển về trạng thái chưa phân quyền, nhưng hồ sơ vẫn được giữ lại.`}
        confirmLabel="Thu hồi quyền"
        cancelLabel="Huỷ"
        variant="danger"
        loading={deleting}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </AdminPageWrapper>
    </ProtectedPage>
  );
}
// Improved filtering

// Improved filtering
