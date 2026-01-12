// User & Auth Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'ops' | 'read';
  createdAt: string;
  lastLogin?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Orders Types
export interface OrderIntake {
  id: string;
  orderCode: string;
  messageId: string;
  clientId: string;
  clientName: string;
  senderAddress: string;
  subject: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  receivedAt: string;
  processedAt?: string;
  linesCount: number;
}

export interface OrderLine {
  id: string;
  orderIntakeId: string;
  lineNumber: number;
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface OrderEvent {
  id: string;
  orderCode: string;
  eventType: 'received' | 'parsed' | 'validated' | 'sent' | 'error' | 'reprocessed';
  timestamp: string;
  details?: string;
  actorEmail?: string;
}

// DLQ Types
export interface DLQOrder {
  id: string;
  orderCode: string;
  messageId: string;
  clientId: string;
  clientName: string;
  errorCode: string;
  errorMessage: string;
  retryCount: number;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  rawPayload?: string;
}

// Master Data Types
export interface Client {
  id: string;
  code: string;
  name: string;
  email?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Remitente {
  id: string;
  clientId: string;
  email: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  region?: string;
  createdAt: string;
}

export interface LocationAlias {
  id: string;
  clientId: string;
  alias: string;
  normalizedLocation: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Dashboard Types
export interface DashboardKPIs {
  ordersToday: number;
  ordersWeek: number;
  errorRate: number;
  pendingDLQ: number;
  avgProcessingTime: number;
  successRate: number;
}

// Audit Types
export interface AuditEntry {
  id: string;
  actorUserId: string;
  actorEmail: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeJson?: string;
  afterJson?: string;
  createdAt: string;
}

// Filter Types
export interface OrderFilters {
  clientId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface DLQFilters {
  resolved?: boolean;
  errorCode?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

// Pagination Types
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationState;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
