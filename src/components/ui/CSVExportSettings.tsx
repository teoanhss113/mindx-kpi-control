'use client';

import { useState, useCallback } from 'react';
import { Modal, ModalHeader, Icon } from './index';
import styles from './CSVExportSettings.module.css';

export interface CSVColumnConfig {
  id: string;
  label: string;
  enabled: boolean;
}

interface CSVExportSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  columns: CSVColumnConfig[];
  onSave: (columns: CSVColumnConfig[]) => void;
  title?: string;
}

export function CSVExportSettings({
  isOpen,
  onClose,
  columns,
  onSave,
  title = 'Cài đặt xuất CSV',
}: CSVExportSettingsProps) {
  const [localColumns, setLocalColumns] = useState<CSVColumnConfig[]>(columns);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleToggle = useCallback((id: string) => {
    setLocalColumns(prev =>
      prev.map(col => (col.id === id ? { ...col, enabled: !col.enabled } : col))
    );
  }, []);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newColumns = [...localColumns];
    const draggedItem = newColumns[draggedIndex];
    newColumns.splice(draggedIndex, 1);
    newColumns.splice(index, 0, draggedItem);

    setLocalColumns(newColumns);
    setDraggedIndex(index);
  }, [draggedIndex, localColumns]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  const handleSave = useCallback(() => {
    onSave(localColumns);
    onClose();
  }, [localColumns, onSave, onClose]);

  const handleReset = useCallback(() => {
    setLocalColumns(columns);
  }, [columns]);

  const handleSelectAll = useCallback(() => {
    setLocalColumns(prev => prev.map(col => ({ ...col, enabled: true })));
  }, []);

  const handleDeselectAll = useCallback(() => {
    setLocalColumns(prev => prev.map(col => ({ ...col, enabled: false })));
  }, []);

  const enabledCount = localColumns.filter(col => col.enabled).length;

  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalHeader title={title} subtitle={`${enabledCount}/${localColumns.length} cột được chọn`} onClose={onClose} />
      
      <div className={styles.modalBody}>
        {/* Quick actions */}
        <div className={styles.quickActions}>
          <button onClick={handleSelectAll} className={styles.quickActionBtn}>
            Chọn tất cả
          </button>
          <button onClick={handleDeselectAll} className={styles.quickActionBtn}>
            Bỏ chọn tất cả
          </button>
          <button onClick={handleReset} className={styles.quickActionBtn}>
            Đặt lại
          </button>
        </div>

        {/* Instructions */}
        <div className={styles.instructions}>
          <Icon.Info size={14} />
          <span>Kéo thả để sắp xếp thứ tự cột. Tích chọn để bật/tắt cột.</span>
        </div>

        {/* Column list */}
        <div className={styles.columnList}>
          {localColumns.map((col, index) => (
            <div
              key={col.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`${styles.columnItem} ${draggedIndex === index ? styles.dragging : ''} ${!col.enabled ? styles.disabled : ''}`}
            >
              {/* Drag handle */}
              <div className={styles.dragHandle}>
                <Icon.GripVertical size={16} />
              </div>

              {/* Checkbox */}
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={col.enabled}
                  onChange={() => handleToggle(col.id)}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxCustom}>
                  {col.enabled && <Icon.Check size={12} />}
                </span>
                <span className={styles.columnLabel}>{col.label}</span>
              </label>

              {/* Order indicator */}
              <div className={styles.orderIndicator}>
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className={styles.modalFooter}>
        <button onClick={onClose} className={styles.cancelBtn}>
          Huỷ
        </button>
        <button onClick={handleSave} className={styles.saveBtn} disabled={enabledCount === 0}>
          Lưu cài đặt
        </button>
      </div>
    </Modal>
  );
}
