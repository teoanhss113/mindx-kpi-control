'use client';

import { useState, useEffect } from 'react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { ErrorBanner } from '@/components/ErrorBanner';
import { AdminPageWrapper } from '@/components/AdminPageWrapper';
import { ActiveStatusBadge, AdminToolbar, AdminTableSection, Icon, SortableHeader, EmptyState, ConfirmDialog, useToast, ToastContainer } from '@/components/ui';
import { useTableSort } from '@/hooks/useTableSort';
import { LABELS, MESSAGES, ENTITIES } from '@/constants';
import {
  getRoles,
  getPages,
  createRole,
  updateRole,
  deleteRole
} from '@/lib/admin-actions';
import { USER_PAGE_KEYS } from '@/lib/pageGroups';
import { getAuthToken } from '@/lib/auth/clientAuth';
import type { Role, Page, RolePermission } from '@/lib/supabase/types';
import styles from '@/app/dashboard.module.css';

interface RoleWithPermissions extends Role {
  role_permissions: (RolePermission & { pages: Page })[];
}

interface PageOption {
  id: string;
  label: string;
  value: string;
}

interface PagePermission {
  pageId: string;
  canView: boolean;
  canEdit: boolean;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);

  // ESC key handler for modal
  useEffect(() => {
    if (!showModal) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showModal]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    pagePermissions: [] as PagePermission[], // Changed from selectedPages
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Confirm dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleWithPermissions | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast notifications
  const { toasts, addToast, removeToast } = useToast();

  const { sortedData, sortBy, sortOrder, handleSort } = useTableSort({
    data: roles,
    defaultSortKey: 'created_at' as keyof RoleWithPermissions,
    defaultSortOrder: 'desc'
  });

  // Load data — auto-syncs pages so all 14 pages are always present
  const loadData = async () => {
    setLoading(true);
    try {
      // Ensure all pages exist in DB before loading
      await fetch('/api/admin/sync-pages', { method: 'POST' });

      const token = await getAuthToken();
      const [rolesResult, pagesResult] = await Promise.all([
        getRoles(token),
        getPages(token)
      ]);

      if (rolesResult.success) {
        setRoles(rolesResult.data);
      }

      if (pagesResult.success) {
        setPages(pagesResult.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter roles
  const filteredRoles = sortedData.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Page options for MultiSelect
  const pageOptions: PageOption[] = pages.map(page => ({
    id: page.id,
    label: page.page_name,
    value: page.id,
  }));

  // Handle form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_active: true,
      pagePermissions: [],
    });
    setFormErrors({});
    setEditingRole(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (role: RoleWithPermissions) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      is_active: role.is_active,
      pagePermissions: role.role_permissions.map(rp => ({
        pageId: rp.page_id,
        canView: rp.can_view ?? true,
        canEdit: rp.can_edit ?? false,
      })),
    });
    setFormErrors({});
    setShowModal(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Tên vai trò là bắt buộc';
    }
    
    // Debug: Log page permissions
    console.log('[validateForm] pagePermissions:', formData.pagePermissions);
    
    const selectedPages = formData.pagePermissions.filter(p => p.canView);
    if (selectedPages.length === 0) {
      errors.pagePermissions = 'Phải chọn ít nhất một trang';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setFormErrors({});
    
    // Small delay to ensure state is updated
    setTimeout(() => {
      if (!validateForm()) {
        console.log('[handleSubmit] Validation failed');
        return;
      }
      
      submitForm();
    }, 100);
  };
  
  const submitForm = async () => {
    setSubmitting(true);
    const loadingToastId = addToast('Đang lưu...', 'loading');
    
    try {
      // Convert pagePermissions to the format expected by backend
      const selectedPages = formData.pagePermissions
        .filter(p => p.canView)
        .map(p => ({
          pageId: p.pageId,
          canView: p.canView,
          canEdit: p.canEdit,
        }));

      const payload = {
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active,
        pagePermissions: selectedPages,
      };

      const token = await getAuthToken();
      const result = editingRole
        ? await updateRole(token, { ...payload, id: editingRole.id })
        : await createRole(token, payload);

      removeToast(loadingToastId);
      
      if (result.success) {
        addToast(MESSAGES.SUCCESS[editingRole ? 'UPDATED' : 'CREATED'](ENTITIES.ROLES), 'success');
        setShowModal(false);
        resetForm();
        loadData();
      } else {
        addToast(result.error || 'Có lỗi xảy ra', 'error');
        setFormErrors({ submit: result.error || 'Có lỗi xảy ra' });
      }
    } catch (error) {
      removeToast(loadingToastId);
      addToast('Có lỗi xảy ra khi lưu vai trò', 'error');
      setFormErrors({ submit: 'Có lỗi xảy ra khi lưu vai trò' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (role: RoleWithPermissions) => {
    setRoleToDelete(role);
    setShowConfirmDialog(true);
  };

  const confirmDelete = async () => {
    if (!roleToDelete) return;

    setDeleting(true);
    const loadingToastId = addToast('Đang xoá...', 'loading');

    try {
      const token = await getAuthToken();
      const result = await deleteRole(token, roleToDelete.id);
      removeToast(loadingToastId);
      
      if (result.success) {
        addToast('Xoá vai trò thành công', 'success');
        setShowConfirmDialog(false);
        setRoleToDelete(null);
        loadData();
      } else {
        addToast(result.error || 'Có lỗi xảy ra khi xoá vai trò', 'error');
      }
    } catch (error) {
      removeToast(loadingToastId);
      addToast('Có lỗi xảy ra khi xoá vai trò', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const getPermissionsSummary = (role: RoleWithPermissions) => {
    const pageCount = role.role_permissions.length;
    if (pageCount === 0) return 'Không có quyền';
    
    const viewCount = role.role_permissions.filter(p => p.can_view).length;
    const editCount = role.role_permissions.filter(p => p.can_edit).length;
    
    return `${viewCount} xem${editCount > 0 ? `, ${editCount} sửa` : ''}`;
  };

  // Helper functions for page permissions
  const togglePageView = (pageId: string) => {
    setFormData(prev => {
      const existing = prev.pagePermissions.find(p => p.pageId === pageId);
      if (existing) {
        // If unchecking view, also uncheck edit
        return {
          ...prev,
          pagePermissions: prev.pagePermissions.map(p =>
            p.pageId === pageId ? { ...p, canView: !p.canView, canEdit: false } : p
          ),
        };
      } else {
        // Add new permission with view only
        return {
          ...prev,
          pagePermissions: [...prev.pagePermissions, { pageId, canView: true, canEdit: false }],
        };
      }
    });
  };

  const togglePageEdit = (pageId: string) => {
    setFormData(prev => {
      const existing = prev.pagePermissions.find(p => p.pageId === pageId);
      if (existing) {
        return {
          ...prev,
          pagePermissions: prev.pagePermissions.map(p =>
            p.pageId === pageId ? { ...p, canEdit: !p.canEdit, canView: true } : p
          ),
        };
      } else {
        // Add new permission with view + edit
        return {
          ...prev,
          pagePermissions: [...prev.pagePermissions, { pageId, canView: true, canEdit: true }],
        };
      }
    });
  };

  const toggleAllView = () => {
    const allSelected = pages.every(page =>
      formData.pagePermissions.some(p => p.pageId === page.id && p.canView)
    );
    setFormData(prev => ({
      ...prev,
      pagePermissions: pages.map(page => {
        const existing = prev.pagePermissions.find(p => p.pageId === page.id);
        return { pageId: page.id, canView: !allSelected, canEdit: allSelected ? false : (existing?.canEdit ?? false) };
      }),
    }));
  };

  const toggleAllEdit = () => {
    const allSelected = pages.every(page =>
      formData.pagePermissions.some(p => p.pageId === page.id && p.canEdit)
    );
    setFormData(prev => ({
      ...prev,
      pagePermissions: pages.map(page => {
        const existing = prev.pagePermissions.find(p => p.pageId === page.id);
        return { pageId: page.id, canView: !allSelected ? true : (existing?.canView ?? false), canEdit: !allSelected };
      }),
    }));
  };

  const toggleGroupView = (groupPages: Page[]) => {
    const groupIds = groupPages.map(p => p.id);
    const allSelected = groupIds.every(id =>
      formData.pagePermissions.some(p => p.pageId === id && p.canView)
    );
    setFormData(prev => ({
      ...prev,
      pagePermissions: prev.pagePermissions
        .filter(p => !groupIds.includes(p.pageId))
        .concat(groupPages.map(page => {
          const existing = prev.pagePermissions.find(p => p.pageId === page.id);
          return { pageId: page.id, canView: !allSelected, canEdit: allSelected ? false : (existing?.canEdit ?? false) };
        })),
    }));
  };

  const toggleGroupEdit = (groupPages: Page[]) => {
    const groupIds = groupPages.map(p => p.id);
    const allSelected = groupIds.every(id =>
      formData.pagePermissions.some(p => p.pageId === id && p.canEdit)
    );
    setFormData(prev => ({
      ...prev,
      pagePermissions: prev.pagePermissions
        .filter(p => !groupIds.includes(p.pageId))
        .concat(groupPages.map(page => {
          const existing = prev.pagePermissions.find(p => p.pageId === page.id);
          return { pageId: page.id, canView: !allSelected ? true : (existing?.canView ?? false), canEdit: !allSelected };
        })),
    }));
  };

  const getPagePermission = (pageId: string) => {
    return formData.pagePermissions.find(p => p.pageId === pageId) || { pageId, canView: false, canEdit: false };
  };

  const userPages = pages.filter(p => USER_PAGE_KEYS.includes(p.key));
  const adminPages = pages.filter(p => !USER_PAGE_KEYS.includes(p.key));

  return (
    <ProtectedPage pageKey="admin-roles">
      <AdminPageWrapper title="Quản lý Vai trò" activePage="admin-roles">
        <AdminToolbar
          search={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Tìm kiếm vai trò..."
          actionLabel={`${LABELS.CREATE} ${ENTITIES.ROLES}`}
          onAction={openCreateModal}
          actionIcon={<Icon.Plus size={16} />}
        />

      {/* Roles Table */}
      {!loading && filteredRoles.length > 0 && (
        <AdminTableSection
          title="Danh sách vai trò"
          count={filteredRoles.length}
          loading={loading}
          isExpanded={showTable}
          onToggle={() => setShowTable(!showTable)}
        >
          <div className={styles.tableScrollWrapper}>
            <table className={styles.studentTable}>
              <thead>
                <tr>
                  <SortableHeader 
                    label="Tên vai trò" 
                    sortKey="name" 
                    currentSortKey={sortBy} 
                    sortOrder={sortOrder} 
                    onSort={(key) => handleSort(key as keyof RoleWithPermissions)} 
                  />
                  <th>Mô tả</th>
                  <th>Quyền truy cập</th>
                  <SortableHeader 
                    label="Trạng thái" 
                    sortKey="is_active" 
                    currentSortKey={sortBy} 
                    sortOrder={sortOrder} 
                    onSort={(key) => handleSort(key as keyof RoleWithPermissions)} 
                  />
                  <SortableHeader 
                    label="Ngày tạo" 
                    sortKey="created_at" 
                    currentSortKey={sortBy} 
                    sortOrder={sortOrder} 
                    onSort={(key) => handleSort(key as keyof RoleWithPermissions)} 
                  />
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <div style={{ fontWeight: 510, color: 'var(--text-primary)' }}>
                        {role.name}
                        {role.is_system_role && (
                          <span style={{ 
                            marginLeft: 'var(--space-2)',
                            fontSize: 12,
                            color: 'var(--text-tertiary)',
                            fontWeight: 400
                          }}>
                            (Hệ thống)
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {role.description || '—'}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {getPermissionsSummary(role)}
                    </td>
                    <td>
                      <ActiveStatusBadge active={role.is_active} />
                    </td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                      {new Date(role.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                        <button
                          className={styles.clearCacheBtn}
                          onClick={() => openEditModal(role)}
                          title="Chỉnh sửa"
                          style={{ padding: 'var(--space-2)', minWidth: 'auto' }}
                        >
                          <Icon.Edit size={16} />
                        </button>
                        {!role.is_system_role && (
                          <button
                            className={styles.clearCacheBtn}
                            onClick={() => handleDelete(role)}
                            title="Xoá"
                            style={{ padding: 'var(--space-2)', minWidth: 'auto' }}
                          >
                            <Icon.Trash size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminTableSection>
      )}

      {/* Empty State */}
      {!loading && filteredRoles.length === 0 && (
        <EmptyState
          icon={<Icon.UsersGroup size={32} />}
          title={searchTerm ? 'Không tìm thấy vai trò' : 'Chưa có vai trò nào'}
          subtitle={searchTerm ? 'Thử tìm kiếm với từ khoá khác' : `${LABELS.CREATE} ${ENTITIES.ROLES} đầu tiên để bắt đầu`}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>
                  {editingRole ? `${LABELS.EDIT} ${ENTITIES.ROLES}` : `${LABELS.CREATE} ${ENTITIES.ROLES} mới`}
                </h2>
                <p className={styles.modalSubtitle}>
                  {editingRole ? `Cập nhật thông tin ${ENTITIES.ROLES}` : `Tạo ${ENTITIES.ROLES} và phân quyền trang`}
                </p>
              </div>
              <button className={styles.closeModalBtn} onClick={() => setShowModal(false)}>
                <svg width="var(--space-4)" height="var(--space-4)" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.modalBody}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-5)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                    Tên vai trò *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={styles.dateInput}
                    style={{ width: '100%' }}
                    placeholder="Nhập tên vai trò"
                  />
                  {formErrors.name && (
                    <div style={{ marginTop: 'var(--space-1)', fontSize: 12, color: '#dc2626' }}>
                      {formErrors.name}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                    Mô tả
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={styles.dateInput}
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                    rows={3}
                    placeholder="Mô tả vai trò (tùy chọn)"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                    Quyền truy cập *
                    <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 'var(--space-2)' }}>
                      ({formData.pagePermissions.filter(p => p.canView).length}/{pages.length} trang)
                    </span>
                  </label>

                  <div style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-comfortable)', overflow: 'hidden', maxHeight: '420px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 1 }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: 'var(--space-3)', fontWeight: 510, borderBottom: '1px solid var(--border-primary)' }}>Trang</th>
                          <th style={{ textAlign: 'center', padding: '6px var(--space-2)', fontWeight: 510, borderBottom: '1px solid var(--border-primary)', width: '80px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                              <span>Xem</span>
                              <button type="button" onClick={toggleAllView} style={{ fontSize: 10, color: 'var(--brand-indigo)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', whiteSpace: 'nowrap' }}>
                                {pages.every(p => formData.pagePermissions.some(pp => pp.pageId === p.id && pp.canView)) ? 'Bỏ tất cả' : 'Chọn tất cả'}
                              </button>
                            </div>
                          </th>
                          <th style={{ textAlign: 'center', padding: '6px var(--space-2)', fontWeight: 510, borderBottom: '1px solid var(--border-primary)', width: '80px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                              <span>Sửa</span>
                              <button type="button" onClick={toggleAllEdit} style={{ fontSize: 10, color: 'var(--brand-indigo)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', whiteSpace: 'nowrap' }}>
                                {pages.every(p => formData.pagePermissions.some(pp => pp.pageId === p.id && pp.canEdit)) ? 'Bỏ tất cả' : 'Chọn tất cả'}
                              </button>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* ── Trang người dùng ── */}
                        {userPages.length > 0 && (
                          <tr>
                            <td style={{ padding: '6px var(--space-3) 6px 20px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-primary)', borderTop: '1px solid var(--border-primary)' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Trang người dùng
                                <span style={{ fontWeight: 400, marginLeft: 6 }}>
                                  ({userPages.filter(p => formData.pagePermissions.some(pp => pp.pageId === p.id && pp.canView)).length}/{userPages.length})
                                </span>
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-primary)', borderTop: '1px solid var(--border-primary)', width: '80px' }}>
                              <button type="button" onClick={() => toggleGroupView(userPages)} style={{ fontSize: 10, color: 'var(--brand-indigo)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', whiteSpace: 'nowrap' }}>
                                {userPages.every(p => formData.pagePermissions.some(pp => pp.pageId === p.id && pp.canView)) ? 'Bỏ nhóm' : 'Chọn nhóm'}
                              </button>
                            </td>
                            <td style={{ textAlign: 'center', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-primary)', borderTop: '1px solid var(--border-primary)', width: '80px' }}>
                              <button type="button" onClick={() => toggleGroupEdit(userPages)} style={{ fontSize: 10, color: 'var(--brand-indigo)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', whiteSpace: 'nowrap' }}>
                                {userPages.every(p => formData.pagePermissions.some(pp => pp.pageId === p.id && pp.canEdit)) ? 'Bỏ nhóm' : 'Chọn nhóm'}
                              </button>
                            </td>
                          </tr>
                        )}
                        {userPages.map((page, index) => {
                          const perm = getPagePermission(page.id);
                          return (
                            <tr key={page.id} style={{ background: index % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                              <td style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border-primary)', paddingLeft: 20 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontWeight: 510, color: 'var(--text-primary)' }}>{page.page_name}</span>
                                  {page.description && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{page.description}</span>}
                                </div>
                              </td>
                              <td style={{ textAlign: 'center', padding: 'var(--space-3)', borderBottom: '1px solid var(--border-primary)' }}>
                                <input type="checkbox" checked={perm.canView} onChange={() => togglePageView(page.id)} className={styles.reasonCheckbox} style={{ cursor: 'pointer' }} />
                              </td>
                              <td style={{ textAlign: 'center', padding: 'var(--space-3)', borderBottom: '1px solid var(--border-primary)' }}>
                                <input type="checkbox" checked={perm.canEdit} onChange={() => togglePageEdit(page.id)} disabled={!perm.canView} className={styles.reasonCheckbox} style={{ cursor: perm.canView ? 'pointer' : 'not-allowed', opacity: perm.canView ? 1 : 0.5 }} />
                              </td>
                            </tr>
                          );
                        })}

                        {/* ── Trang quản trị ── */}
                        {adminPages.length > 0 && (
                          <tr>
                            <td style={{ padding: '6px var(--space-3) 6px 20px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-primary)', borderTop: '1px solid var(--border-primary)' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Trang quản trị
                                <span style={{ fontWeight: 400, marginLeft: 6 }}>
                                  ({adminPages.filter(p => formData.pagePermissions.some(pp => pp.pageId === p.id && pp.canView)).length}/{adminPages.length})
                                </span>
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-primary)', borderTop: '1px solid var(--border-primary)', width: '80px' }}>
                              <button type="button" onClick={() => toggleGroupView(adminPages)} style={{ fontSize: 10, color: 'var(--brand-indigo)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', whiteSpace: 'nowrap' }}>
                                {adminPages.every(p => formData.pagePermissions.some(pp => pp.pageId === p.id && pp.canView)) ? 'Bỏ nhóm' : 'Chọn nhóm'}
                              </button>
                            </td>
                            <td style={{ textAlign: 'center', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-primary)', borderTop: '1px solid var(--border-primary)', width: '80px' }}>
                              <button type="button" onClick={() => toggleGroupEdit(adminPages)} style={{ fontSize: 10, color: 'var(--brand-indigo)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', whiteSpace: 'nowrap' }}>
                                {adminPages.every(p => formData.pagePermissions.some(pp => pp.pageId === p.id && pp.canEdit)) ? 'Bỏ nhóm' : 'Chọn nhóm'}
                              </button>
                            </td>
                          </tr>
                        )}
                        {adminPages.map((page, index) => {
                          const perm = getPagePermission(page.id);
                          return (
                            <tr key={page.id} style={{ background: index % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                              <td style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border-primary)', paddingLeft: 20 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontWeight: 510, color: 'var(--text-primary)' }}>{page.page_name}</span>
                                  {page.description && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{page.description}</span>}
                                </div>
                              </td>
                              <td style={{ textAlign: 'center', padding: 'var(--space-3)', borderBottom: '1px solid var(--border-primary)' }}>
                                <input type="checkbox" checked={perm.canView} onChange={() => togglePageView(page.id)} className={styles.reasonCheckbox} style={{ cursor: 'pointer' }} />
                              </td>
                              <td style={{ textAlign: 'center', padding: 'var(--space-3)', borderBottom: '1px solid var(--border-primary)' }}>
                                <input type="checkbox" checked={perm.canEdit} onChange={() => togglePageEdit(page.id)} disabled={!perm.canView} className={styles.reasonCheckbox} style={{ cursor: perm.canView ? 'pointer' : 'not-allowed', opacity: perm.canView ? 1 : 0.5 }} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {formErrors.pagePermissions && (
                    <div style={{ marginTop: 'var(--space-2)', fontSize: 12, color: '#dc2626' }}>
                      {formErrors.pagePermissions}
                    </div>
                  )}
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
                    Vai trò hoạt động
                  </label>
                </div>

                {formErrors.submit && <ErrorBanner message={formErrors.submit} />}

                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      border: '1px solid var(--border-primary)',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-comfortable)',
                      fontSize: 14,
                      cursor: 'pointer',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    Huỷ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      border: 'none',
                      background: submitting ? 'var(--text-quaternary)' : 'var(--brand-indigo)',
                      color: 'white',
                      borderRadius: 'var(--radius-comfortable)',
                      fontSize: 14,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      fontWeight: 510
                    }}
                  >
                    {submitting ? LABELS.UPDATING : (editingRole ? LABELS.UPDATE : `${LABELS.CREATE} ${ENTITIES.ROLES}`)}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={showConfirmDialog}
        onClose={() => {
          setShowConfirmDialog(false);
          setRoleToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Xác nhận xoá vai trò"
        message={`Bạn có chắc chắn muốn xoá vai trò "${roleToDelete?.name}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xoá vai trò"
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
// Refactored CRUD logic
// Refactored CRUD logic
// Consolidated CRUD patterns

// Refactored CRUD logic
