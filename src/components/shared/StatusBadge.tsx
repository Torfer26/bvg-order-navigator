import React from 'react';
import { CheckCircle2, Clock, AlertCircle, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'pending' | 'neutral';

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

// Convenience mapping for order statuses
export function OrderStatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { type: StatusType; label: string }> = {
    pending: { type: 'pending', label: 'In attesa' },
    processing: { type: 'info', label: 'In elaborazione' },
    completed: { type: 'success', label: 'Completato' },
    error: { type: 'error', label: 'Errore' },
  };

  const config = statusMap[status] || { type: 'neutral' as StatusType, label: status };
  return <StatusBadge status={config.type} label={config.label} />;
}

// DLQ resolved status
export function DLQStatusBadge({ resolved }: { resolved: boolean }) {
  return resolved ? (
    <StatusBadge status="success" label="Risolto" />
  ) : (
    <StatusBadge status="error" label="Da risolvere" />
  );
}
