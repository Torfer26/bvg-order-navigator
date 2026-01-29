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

// Order Status Types (matching bvg.order_intake_status ENUM)
export type OrderIntakeStatus =
  | 'RECEIVED'       // Recibido, aún no procesado
  | 'PARSING'        // En análisis por IA
  | 'VALIDATING'     // Validando datos
  | 'AWAITING_INFO'  // Esperando respuesta del cliente
  | 'IN_REVIEW'      // En revisión manual
  | 'APPROVED'       // Aprobado, listo para integración
  | 'PROCESSING'     // Integrando con sistemas externos
  | 'COMPLETED'      // Integración completa
  | 'REJECTED'       // Rechazado manualmente
  | 'ERROR';         // Error en procesamiento

// Orders Types
export interface OrderIntake {
  id: string;
  orderCode: string;
  messageId: string;
  clientId: string;
  clientName: string;
  senderAddress: string;
  subject: string;
  status: OrderIntakeStatus;
  receivedAt: string;
  processedAt?: string;
  linesCount: number;
}

// Location status for order lines
export type LocationStatus = 'AUTO' | 'PENDING_LOCATION' | 'MANUALLY_SET' | 'CONFIRMED';

// Location suggestion from similarity search
export interface LocationSuggestion {
  id: number;
  name: string;
  address?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  score: number;
}

export interface OrderLine {
  id: string;
  orderIntakeId: string;
  lineNumber: number;
  customer: string;       // CLIENTE - nombre del consignatario
  destination: string;    // DESTINO - ciudad de entrega
  destinationId?: number; // ID de location para lookup
  notes: string;          // NOTA - descripción del producto
  pallets: number;        // PALETS - cantidad
  deliveryDate?: string;  // FECHA DE ENTREGA
  observations?: string;  // OBSERVACIONES
  unit: string;           // PLT por defecto
  // New fields for location suggestions
  locationStatus?: LocationStatus;
  locationSuggestions?: LocationSuggestion[];
  rawDestinationText?: string;
  rawCustomerText?: string;
  locationSetBy?: string;
  locationSetAt?: string;
}

// Location from customer_location_stg for search results
export interface Location {
  id: number;
  code?: string;
  name: string;
  address?: string;
  zipCode?: string;
  city?: string;
  province?: string;
  country?: string;
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
