'use client';

import { useState, useEffect } from 'react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { ErrorBanner } from '@/components/ErrorBanner';
import { getRegions, createRegion, updateRegion, deleteRegion } from '@/lib/admin-actions';
import { getAuthToken } from '@/lib/auth/clientAuth';
import { AdminPageWrapper } from '@/components/AdminPageWrapper';
import { useTableSort } from '@/hooks/useTableSort';
import { ActiveStatusBadge, SortableHeader, AdminToolbar, AdminTableSection, Icon, Spinner, EmptyState, CentreSelect, TableActionButton, TableActionGroup, Badge } from '@/components/ui';
import { fetchAllCentres, type Centre } from '@/services/centresService';
import { getCache, setCache } from '@/lib/idb';
import { LABELS, MESSAGES, ENTITIES, CACHE_KEYS, SYSTEM_ADMIN_LABELS } from '@/constants';
import styles from '@/app/dashboard.module.css';

interface Region {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  region_centres: RegionCentre[];
}

interface RegionCentre {
  id: string;
  centre_id: string;
  centre_name: string | null;
  centre_short_name: string | null;
}

export default function RegionsPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [loading, setLoading] = useState(true);
  const [centresLoading, setCentresLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
  const [showTable, setShowTable] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    selectedCentres: [] as string[],
  });

  useEffect(() => {
    loadRegions();
    loadCentres();
  }, []);

  async function loadCentres() {
    setCentresLoading(true);
    setError(null);
    try {
      // Check cache first
      const cached = await getCache(CACHE_KEYS.CENTRES);
      if (cached?.centres?.length) {
        setCentres(cached.centres);
        return;
      }
      
      // Fetch from API if not cached
      const data = await fetchAllCentres();
      setCentres(data);
      await setCache(CACHE_KEYS.CENTRES, { centres: data });
    } catch (error: any) {
      console.error('Failed to load centres:', error);
      setError('Không thể tải danh sách cơ sở. Vui lòng thử lại.');
    } finally {
      setCentresLoading(false);
    }
  }

  // Convert centres to SelectOption format
  // No longer needed - CentreSelect handles this internally

  async function loadRegions() {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const result = await getRegions(token);
      if (result.success) {
        setRegions(result.data || []);
      } else {
        console.error('Failed to load regions:', result.error);
        setError(`Không thể tải danh sách khu vực: ${result.error}`);
        setRegions([]);
      }
    } catch (error: any) {
      console.error('Failed to load regions:', error);
      setError(`Lỗi khi tải dữ liệu: ${error.message}`);
      setRegions([]);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingRegion(null);
    setError(null);
    setFormData({
      name: '',
      description: '',
      is_active: true,
      selectedCentres: [],
    });
    setShowModal(true);
  }

  function openEditModal(region: Region) {
    setEditingRegion(region);
    setError(null);
    setFormData({
      name: region.name,
      description: region.description || '',
      is_active: region.is_active,
      selectedCentres: region.region_centres.map(rc => rc.centre_id),
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Vui lòng nhập tên khu vực');
      return;
    }

    if (formData.selectedCentres.length === 0) {
      setError('Vui lòng chọn ít nhất một cơ sở');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const token = await getAuthToken();
      let result;
      if (editingRegion) {
        result = await updateRegion(token, {
          id: editingRegion.id,
          name: formData.name,
          description: formData.description,
          is_active: formData.is_active,
          selectedCentres: formData.selectedCentres,
          centresData: centres,
        });
      } else {
        result = await createRegion(token, {
          name: formData.name,
          description: formData.description,
          is_active: formData.is_active,
          selectedCentres: formData.selectedCentres,
          centresData: centres,
        });
      }

      if (result.success) {
        setShowModal(false);
        loadRegions();
      } else {
        setError(result.error);
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      setError(error.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(region: Region) {
    if (!confirm(`Xoá khu vực "${region.name}"?\n\nLưu ý: Các phân quyền liên quan sẽ bị xoá.`)) return;

    try {
      const token = await getAuthToken();
      const result = await deleteRegion(token, region.id);
      if (result.success) {
        loadRegions();
      } else {
        alert('Lỗi: ' + result.error);
      }
    } catch (error: any) {
      alert('Lỗi: ' + error.message);
    }
  }

  function toggleCentre(centreId: string) {
    // No longer needed - CentreSelect handles this internally
  }

  function handleCentresChange(selectedIds: string[]) {
    setFormData(prev => ({
      ...prev,
      selectedCentres: selectedIds,
    }));
  }

  const filteredRegions = regions.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Create sortable data with computed fields
  const sortableRegions = filteredRegions.map(region => ({
    ...region,
    centres_count: region.region_centres.length,
    centres_text: region.region_centres.map(rc => rc.centre_short_name || rc.centre_id).join(', ') || 'Chưa có cơ sở'
  }));

  type RegionSortKey = 'name' | 'centres_count' | 'is_active' | 'created_at';

  const { sortedData, sortBy, sortOrder, handleSort } = useTableSort<typeof sortableRegions[0], RegionSortKey>({
    data: sortableRegions,
    defaultSortKey: 'created_at' as RegionSortKey,
    defaultSortOrder: 'desc'
  });

  return (
    <ProtectedPage pageKey="admin-regions">
      <AdminPageWrapper title={SYSTEM_ADMIN_LABELS.REGIONS_TITLE} activePage="admin-regions">
        {/* Error Banner */}
        {error && <ErrorBanner message={error} />}

        {/* Toolbar */}
        <AdminToolbar
          search={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Tìm khu vực..."
          actionLabel={`${LABELS.CREATE} ${ENTITIES.REGIONS}`}
          onAction={openCreateModal}
          actionIcon={<Icon.Plus />}
        />

      {/* Regions Table */}
      {!loading && filteredRegions.length > 0 && (
        <AdminTableSection
          title="Danh sách khu vực"
          count={filteredRegions.length}
          loading={loading}
          isExpanded={showTable}
          onToggle={() => setShowTable(!showTable)}
        >
          <div className={styles.tableScrollWrapper}>
            <table className={styles.studentTable}>
              <thead>
                <tr>
                  <SortableHeader label="Tên khu vực" sortKey="name" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as RegionSortKey)} />
                  <th>Mô tả</th>
                  <SortableHeader label="Cơ sở" sortKey="centres_count" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as RegionSortKey)} />
                  <SortableHeader label="Trạng thái" sortKey="is_active" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as RegionSortKey)} />
                  <SortableHeader label="Ngày tạo" sortKey="created_at" currentSortKey={sortBy} sortOrder={sortOrder} onSort={(key) => handleSort(key as RegionSortKey)} />
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((region) => (
                  <tr key={region.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        <div style={{ fontWeight: 510, textTransform: 'capitalize' }}>{region.name}</div>
                        {region.description && (
                          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                            {region.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {region.description || '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        <div style={{ fontWeight: 510 }}>{region.centres_count} cơ sở</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                          {region.region_centres.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                              {region.region_centres.slice(0, 3).map((rc) => (
                                <Badge key={rc.id} variant="default" size="sm" shape="rounded">
                                  {rc.centre_short_name || rc.centre_id}
                                </Badge>
                              ))}
                              {region.region_centres.length > 3 && (
                                <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
                                  +{region.region_centres.length - 3} khác
                                </span>
                              )}
                            </div>
                          ) : (
                            'Chưa có cơ sở'
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <ActiveStatusBadge active={region.is_active} />
                    </td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                      {new Date(region.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td>
                      <TableActionGroup>
                        <TableActionButton label="Chỉnh sửa" icon={<Icon.Edit />} onClick={() => openEditModal(region)} />
                        <TableActionButton label="Xoá" icon={<Icon.Trash />} onClick={() => handleDelete(region)} variant="danger" />
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
      {!loading && filteredRegions.length === 0 && (
        <EmptyState
          icon={<Icon.MapPin size={32} />}
          title={searchTerm ? 'Không tìm thấy khu vực' : 'Chưa có khu vực nào'}
          subtitle={searchTerm ? 'Thử tìm kiếm với từ khoá khác' : `${LABELS.CREATE} ${ENTITIES.REGIONS} đầu tiên để bắt đầu`}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>
                  {editingRegion ? `${LABELS.EDIT} ${ENTITIES.REGIONS}` : `${LABELS.CREATE} ${ENTITIES.REGIONS} mới`}
                </h2>
                <p className={styles.modalSubtitle}>
                  {editingRegion ? `Cập nhật thông tin ${ENTITIES.REGIONS}` : `Tạo ${ENTITIES.REGIONS} và chọn các cơ sở`}
                </p>
              </div>
              <button className={styles.closeModalBtn} onClick={() => setShowModal(false)}>
                <Icon.Close size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.modalBody}>
              {error && <ErrorBanner message={error} />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-5)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                    Tên khu vực *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ví dụ: Miền Bắc, Miền Nam..."
                    className={styles.dateInput}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                    Mô tả
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Mô tả về khu vực này..."
                    rows={3}
                    className={styles.dateInput}
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 510, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                    Chọn cơ sở *
                  </label>
                  {centresLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-4)', color: 'var(--text-tertiary)' }}>
                      <Spinner size={16} />
                      <span>Đang tải danh sách cơ sở...</span>
                    </div>
                  ) : centres.length === 0 ? (
                    <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-quaternary)', fontSize: 13 }}>
                      Không có cơ sở nào
                    </div>
                  ) : (
                    <>
                      <CentreSelect menuPosition="fixed"
                        centres={centres}
                        selected={formData.selectedCentres}
                        onChange={handleCentresChange}
                        placeholder="Chọn cơ sở"
                        searchable
                        maxDisplay={2}
                      />
                      <p style={{ fontSize: 13, color: 'var(--text-quaternary)', marginTop: 'var(--space-2)' }}>
                        {formData.selectedCentres.length === 0 
                          ? `Chưa chọn cơ sở nào (Tổng: ${centres.length})`
                          : `Đã chọn: ${formData.selectedCentres.length} / ${centres.length} cơ sở`
                        }
                      </p>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <input
                    type="checkbox"
                    id="is_active_region"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className={styles.reasonCheckbox}
                  />
                  <label htmlFor="is_active_region" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Khu vực hoạt động
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                  <button type="button" className={styles.clearCacheBtn} onClick={() => setShowModal(false)}>
                    Huỷ
                  </button>
                  <button type="submit" className={styles.primaryBtn} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Spinner size={14} />
                        {editingRegion ? 'Đang cập nhật...' : 'Đang tạo...'}
                      </>
                    ) : (
                      editingRegion ? LABELS.UPDATE : `${LABELS.CREATE} ${ENTITIES.REGIONS}`
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageWrapper>
    </ProtectedPage>
  );
}
// Extracted reusable logic

// Extracted reusable patterns
