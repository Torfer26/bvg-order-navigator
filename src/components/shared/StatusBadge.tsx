import React from 'react';
import { CheckCircle2, Clock, AlertCircle, Loader2, XCircle, Eye, Sparkles, Send, Ban, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { OrderIntakeStatus } from '@/types';

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'pending' | 'neutral' | 'purple' | 'orange' | 'teal';

interface StatusConfig {
  icon: React.ElementType;
  className: string;
}

const statusConfigs: Record<StatusType, StatusConfig> = {
  success: { icon: CheckCircle2, className: 'status-badge-success' },
  warning: { icon: Clock, className: 'status-badge-warning' },
  error: { icon: XCircle, className: 'status-badge-error' },
  info: { icon: AlertCircle, className: 'status-badge-info' },
  pending: { icon: Loader2, className: 'status-badge-warning' },
  neutral: { icon: Clock, className: 'status-badge-neutral' },
  purple: { icon: Eye, className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  orange: { icon: Clock, className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  teal: { icon: CheckCircle2, className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
};

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({ status, label, showIcon = true, className }: StatusBadgeProps) {
  const config = statusConfigs[status];
  const Icon = config.icon;

  return (
    <span className={cn('status-badge', config.className, className)}>
      {showIcon && (
        <Icon className={cn('h-3.5 w-3.5', status === 'pending' && 'animate-spin')} />
      )}
      {label}
    </span>
  );
}

// Convenience mapping for order statuses (new ENUM-based)
export function OrderStatusBadge({ status }: { status: OrderIntakeStatus | string }) {
  const { t } = useLanguage();
  
  // Map DB status to UI config
  const statusMap: Record<OrderIntakeStatus, { type: StatusType; icon?: React.ElementType }> = {
    RECEIVED: { type: 'info', icon: Inbox },
    PARSING: { type: 'warning', icon: Sparkles },
    VALIDATING: { type: 'warning', icon: Loader2 },
    AWAITING_INFO: { type: 'orange', icon: Clock },
    IN_REVIEW: { type: 'purple', icon: Eye },
    APPROVED: { type: 'teal', icon: CheckCircle2 },
    PROCESSING: { type: 'warning', icon: Send },
    COMPLETED: { type: 'success', icon: CheckCircle2 },
    REJECTED: { type: 'error', icon: Ban },
    ERROR: { type: 'error', icon: XCircle },
  };

  const config = statusMap[status as OrderIntakeStatus];
  if (!config) {
    return <StatusBadge status="neutral" label={status} />;
  }
  
  // Get translated label, fallback to status code if not found
  const label = t.orderStatus[status as keyof typeof t.orderStatus] || status;
  
  return <StatusBadge status={config.type} label={label} />;
}

// DLQ resolved status
export function DLQStatusBadge({ resolved }: { resolved: boolean }) {
  const { t } = useLanguage();
  
  return resolved ? (
    <StatusBadge status="success" label={t.dlq.resolved} />
  ) : (
    <StatusBadge status="error" label={t.dlq.unresolved} />
  );
}
