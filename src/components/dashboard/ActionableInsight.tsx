'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import styles from './dashboard.module.css';

interface ActionableInsightProps {
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  icon: React.ReactNode;
  href: string;
  delay: number;
}

export function ActionableInsight({ 
  title, 
  description, 
  severity, 
  icon, 
  href, 
  delay 
}: ActionableInsightProps) {
  const router = useRouter();
  
  const severityColors = {
    info: 'var(--brand-indigo)',
    warning: 'var(--status-warning)',
    critical: 'var(--status-error)',
  };
  
  return (
    <motion.div
      className={styles.insightCard}
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
      style={{ borderLeftColor: severityColors[severity] }}
    >
      <div className={styles.insightHeader}>
        <span className={styles.insightIcon} style={{ color: severityColors[severity] }}>
          {icon}
        </span>
      </div>
      <div className={styles.insightContent}>
        <div className={styles.insightTitle}>{title}</div>
        <div className={styles.insightDescription}>{description}</div>
      </div>
      <svg 
        width="14" 
        height="14" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
        style={{ flexShrink: 0, color: 'var(--text-tertiary)' }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </motion.div>
  );
}
