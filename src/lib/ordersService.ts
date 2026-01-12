/**
 * Orders Service - Fetches real data from PostgREST API
 */

import type { OrderIntake, DLQOrder, DashboardKPIs, Holiday } from '@/types';

// API URL - uses Vite proxy in development, or direct URL in production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Fetch orders from orders_staging table
 */
export async function fetchOrders(): Promise<OrderIntake[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/orders_staging?order=created_at.desc`);
    if (!response.ok) throw new Error('Failed to fetch orders');
    
    const data = await response.json();
    
    // Map database fields to frontend types
    return data.map((row: any) => ({
      id: String(row.id),
      orderCode: `ORD-${row.id}`,
      messageId: row.message_id,
      clientId: row.customer_name || 'unknown',
      clientName: row.customer_name || 'Sin cliente',
      senderAddress: row.from_email || '',
      subject: row.subject || 'Sin asunto',
      status: mapStatus(row.status),
      receivedAt: row.created_at,
      processedAt: row.sent_at || row.approved_at,
      linesCount: row.pallets ? Math.ceil(Number(row.pallets)) : 0,
    }));
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
}

/**
 * Fetch DLQ orders
 */
export async function fetchDLQOrders(): Promise<DLQOrder[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/dlq_orders?order=created_at.desc`);
    if (!response.ok) throw new Error('Failed to fetch DLQ orders');
    
    const data = await response.json();
    
    return data.map((row: any) => ({
      id: String(row.id),
      orderCode: `DLQ-${row.id}`,
      messageId: row.message_id,
      clientId: 'unknown',
      clientName: 'Desconocido',
      errorCode: row.error_code || 'UNKNOWN',
      errorMessage: row.error_detail || 'Error desconocido',
      retryCount: row.retry_count || 0,
      resolved: row.resolved || false,
      resolvedAt: undefined,
      resolvedBy: undefined,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error fetching DLQ orders:', error);
    return [];
  }
}

/**
 * Fetch holidays
 */
export async function fetchHolidays(): Promise<Holiday[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/holidays?order=date.asc`);
    if (!response.ok) throw new Error('Failed to fetch holidays');
    
    const data = await response.json();
    
    return data.map((row: any, index: number) => ({
      id: `h-${index}`,
      date: row.date,
      name: row.name,
      region: row.ccaa || row.scope,
      createdAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return [];
  }
}

/**
 * Fetch dashboard KPIs
 */
export async function fetchDashboardKPIs(): Promise<DashboardKPIs> {
  try {
    // Fetch orders to calculate KPIs
    const orders = await fetchOrders();
    const dlqOrders = await fetchDLQOrders();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const ordersToday = orders.filter((o) => new Date(o.receivedAt) >= today).length;
    const ordersWeek = orders.filter((o) => new Date(o.receivedAt) >= weekAgo).length;
    const errors = orders.filter((o) => o.status === 'error').length;
    const pendingDLQ = dlqOrders.filter((o) => !o.resolved).length;
    
    return {
      ordersToday,
      ordersWeek,
      errorRate: ordersWeek > 0 ? (errors / ordersWeek) * 100 : 0,
      pendingDLQ,
      avgProcessingTime: 15, // TODO: Calculate from actual data
      successRate: ordersWeek > 0 ? ((ordersWeek - errors) / ordersWeek) * 100 : 100,
    };
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    return {
      ordersToday: 0,
      ordersWeek: 0,
      errorRate: 0,
      pendingDLQ: 0,
      avgProcessingTime: 0,
      successRate: 100,
    };
  }
}

/**
 * Map database status to frontend status
 */
function mapStatus(dbStatus: string): OrderIntake['status'] {
  const statusMap: Record<string, OrderIntake['status']> = {
    'NEW': 'pending',
    'PENDING_INFO': 'pending',
    'READY_FOR_REVIEW': 'processing',
    'APPROVED': 'completed',
    'SENT': 'completed',
    'REJECTED': 'error',
    'ERROR': 'error',
  };
  return statusMap[dbStatus] || 'pending';
}

/**
 * Get unique clients from orders
 */
export async function fetchClients() {
  const orders = await fetchOrders();
  const clientMap = new Map<string, { id: string; code: string; name: string; email: string; active: boolean; createdAt: string; updatedAt: string }>();
  
  orders.forEach((order) => {
    if (order.clientName && !clientMap.has(order.clientId)) {
      clientMap.set(order.clientId, {
        id: order.clientId,
        code: order.clientId.toUpperCase().replace(/\s/g, '_'),
        name: order.clientName,
        email: order.senderAddress,
        active: true,
        createdAt: order.receivedAt,
        updatedAt: order.receivedAt,
      });
    }
  });
  
  return Array.from(clientMap.values());
}
