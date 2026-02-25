'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import styles from './dashboard.module.css';

interface KPICardProps {
  label: string;
  value: string;
  description: string;
  color: string;
  icon: React.ReactNode;
  href: string;
  delay: number;
  lastUpdated?: string;
}

export function KPICard({ 
  label, 
  value, 
  description, 
  color, 
  icon, 
  href, 
  delay, 
  lastUpdated 
}: KPICardProps) {
  const router = useRouter();
  
  return (
    <motion.div
      className={styles.kpiCard}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      onClick={() => router.push(href)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push(href);
        }
      }}
    >
      <div className={styles.kpiHeader}>
        <span className={styles.kpiIcon}>{icon}</span>
        <span className={styles.kpiLabel}>{label}</span>
      </div>
      <div className={styles.kpiValue} style={{ color }}>{value}</div>
      <div className={styles.kpiDescription}>{description}</div>
      {lastUpdated && (
        <div className={styles.kpiTimestamp}>
          Cập nhật: {lastUpdated}
        </div>
      )}
    </motion.div>
  );
}
