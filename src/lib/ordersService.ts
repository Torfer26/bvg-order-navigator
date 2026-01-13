/**
 * Orders Service - Fetches real data from PostgREST API (bvg schema)
 */

import type { OrderIntake, DLQOrder, DashboardKPIs, Holiday } from '@/types';

// API URL - uses Vite proxy in development, or direct URL in production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Fetch orders from ordenes_intake table (bvg schema)
 */
export async function fetchOrders(): Promise<OrderIntake[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/ordenes_intake?order=order_date.desc&limit=100`);
    if (!response.ok) throw new Error('Failed to fetch orders');
    
    const data = await response.json();
    
    // Map database fields to frontend types
    return data.map((row: any) => ({
      id: String(row.id),
      orderCode: row.order_code || `ORD-${row.id}`,
      messageId: row.message_id || '',
      clientId: String(row.client_id),
      clientName: `Cliente ${row.client_id}`,
      senderAddress: row.sender_address || '',
      subject: row.subject || 'Sin asunto',
      status: mapIntakeSource(row.source),
      receivedAt: row.order_date,
      processedAt: row.updated_at,
      linesCount: 0, // Se calculará desde ordenes_intake_lineas si es necesario
    }));
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
}

/**
 * Fetch DLQ orders from bvg.dlq_orders
 */
export async function fetchDLQOrders(): Promise<DLQOrder[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/dlq_orders?order=created_at.desc&limit=100`);
    if (!response.ok) throw new Error('Failed to fetch DLQ orders');
    
    const data = await response.json();
    
    return data.map((row: any) => ({
      id: String(row.id),
      orderCode: row.intake_id ? `ORD-${row.intake_id}` : `DLQ-${row.id}`,
      messageId: row.message_id,
      clientId: row.intake_id ? String(row.intake_id) : 'unknown',
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
 * Fetch dashboard KPIs from real data
 */
export async function fetchDashboardKPIs(): Promise<DashboardKPIs> {
  try {
    const [orders, dlqOrders, emailStats] = await Promise.all([
      fetchOrders(),
      fetchDLQOrders(),
      fetchEmailStats(),
    ]);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const ordersToday = orders.filter((o) => new Date(o.receivedAt) >= today).length;
    const ordersWeek = orders.filter((o) => new Date(o.receivedAt) >= weekAgo).length;
    const emailsToday = emailStats.filter((e) => new Date(e.receivedAt) >= today).length;
    const pendingDLQ = dlqOrders.filter((o) => !o.resolved).length;
    
    return {
      ordersToday,
      ordersWeek,
      errorRate: ordersWeek > 0 ? (pendingDLQ / ordersWeek) * 100 : 0,
      pendingDLQ,
      avgProcessingTime: 15, // TODO: Calculate from orders_log
      successRate: ordersWeek > 0 ? ((ordersWeek - pendingDLQ) / ordersWeek) * 100 : 100,
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
 * Map database intake_source to frontend status
 */
function mapIntakeSource(source: string): OrderIntake['status'] {
  const sourceMap: Record<string, OrderIntake['status']> = {
    'EMAIL': 'completed',
    'WHATSAPP': 'completed',
    'CALL': 'processing',
    'OTHER': 'pending',
  };
  return sourceMap[source] || 'pending';
}

/**
 * Fetch clients from customer_stg table
 */
export async function fetchClients() {
  try {
    const response = await fetch(`${API_BASE_URL}/customer_stg?order=description.asc`);
    if (!response.ok) throw new Error('Failed to fetch clients');
    
    const data = await response.json();
    
    return data.map((row: any) => ({
      id: row.id,
      code: row.id,
      name: row.description || row.id,
      email: '', // No disponible en customer_stg
      active: row.is_enable !== false,
      createdAt: row.imported_at,
      updatedAt: row.imported_at,
      companyCode: row.company_code,
      type: row.type,
      address: row.address,
      location: row.location,
      country: row.country,
    }));
  } catch (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
}

/**
 * Fetch customer emails
 */
export async function fetchCustomerEmails() {
  try {
    const response = await fetch(`${API_BASE_URL}/customer_emails?order=customer_id.asc`);
    if (!response.ok) throw new Error('Failed to fetch customer emails');
    
    const data = await response.json();
    
    return data.map((row: any) => ({
      id: String(row.id),
      customerId: row.customer_id,
      email: row.email,
      emailType: row.email_type,
      active: row.active,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error fetching customer emails:', error);
    return [];
  }
}

// ========== NEW MONITORING FUNCTIONS ==========

/**
 * Fetch email intake statistics from email_intake_stats
 */
export async function fetchEmailStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/email_intake_stats?order=received_at.desc&limit=100`);
    if (!response.ok) throw new Error('Failed to fetch email stats');
    
    const data = await response.json();
    
    return data.map((row: any) => ({
      id: String(row.id),
      receivedAt: row.received_at,
      messageId: row.message_id,
      fromAddress: row.from_address,
      fromDomain: row.from_domain,
      subject: row.subject,
      hasAttachments: row.has_attachments,
      attachmentsPdf: row.attachments_pdf || 0,
      attachmentsExcel: row.attachments_excel || 0,
      attachmentsOther: row.attachments_other || 0,
      customerId: row.customer_id,
      customerName: row.customer_name,
    }));
  } catch (error) {
    console.error('Error fetching email stats:', error);
    return [];
  }
}

/**
 * Fetch orders logs from orders_log
 */
export async function fetchOrdersLog(messageId?: string) {
  try {
    let url = `${API_BASE_URL}/orders_log?order=created_at.desc&limit=100`;
    if (messageId) {
      url = `${API_BASE_URL}/orders_log?message_id=eq.${messageId}&order=created_at.asc`;
    }
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch orders log');
    
    const data = await response.json();
    
    return data.map((row: any) => ({
      id: String(row.id),
      messageId: row.message_id,
      intakeId: row.intake_id,
      step: row.step,
      status: row.status,
      info: row.info,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error fetching orders log:', error);
    return [];
  }
}

/**
 * Fetch order events from order_events
 */
export async function fetchOrderEvents() {
  try {
    const response = await fetch(`${API_BASE_URL}/order_events?order=created_at.desc&limit=100`);
    if (!response.ok) throw new Error('Failed to fetch order events');
    
    const data = await response.json();
    
    return data.map((row: any) => ({
      id: String(row.id),
      intakeId: row.intake_id,
      eventType: row.event_type,
      eventData: row.event_data,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error fetching order events:', error);
    return [];
  }
}

/**
 * Fetch email triage data
 */
export async function fetchEmailTriage() {
  try {
    const response = await fetch(`${API_BASE_URL}/email_triage?order=created_at.desc&limit=100`);
    if (!response.ok) throw new Error('Failed to fetch email triage');
    
    const data = await response.json();
    
    return data.map((row: any) => ({
      id: String(row.triage_id),
      clientId: row.client_id,
      messageId: row.message_id,
      fromEmail: row.from_email,
      subject: row.subject,
      isOrderEmail: row.is_order_email,
      preferredSource: row.preferred_source,
      triageOutput: row.triage_output,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error fetching email triage:', error);
    return [];
  }
}

/**
 * Fetch expediciones (shipments)
 */
export async function fetchExpediciones() {
  try {
    const response = await fetch(`${API_BASE_URL}/expediciones?order=delivery_date.desc&limit=100`);
    if (!response.ok) throw new Error('Failed to fetch expediciones');
    
    const data = await response.json();
    
    return data.map((row: any) => ({
      id: String(row.id),
      code: row.expedicion_code,
      clientId: row.client_id,
      originId: row.origin_id,
      destinationId: row.destination_id,
      deliveryDate: row.delivery_date,
      palletsTotal: Number(row.pallets_total) || 0,
      weightTotal: Number(row.weight_kg_total) || 0,
      status: row.status,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error fetching expediciones:', error);
    return [];
  }
}

/**
 * Fetch remitentes (customer locations) from customer_location_stg
 */
export async function fetchRemitentes() {
  try {
    const response = await fetch(`${API_BASE_URL}/customer_location_stg?order=description.asc&limit=500`);
    if (!response.ok) throw new Error('Failed to fetch remitentes');
    
    const data = await response.json();
    
    return data.map((row: any) => ({
      id: row.id,
      code: row.code || row.id,
      name: row.description || row.id,
      type: row.type,
      address: row.address,
      zipCode: row.zip_code,
      location: row.location,
      district: row.district,
      region: row.region,
      country: row.country,
      latitude: row.latitude ? Number(row.latitude) : undefined,
      longitude: row.longitude ? Number(row.longitude) : undefined,
      createdAt: row.imported_at,
    }));
  } catch (error) {
    console.error('Error fetching remitentes:', error);
    return [];
  }
}

/**
 * Fetch location aliases from location_aliases
 */
export async function fetchLocationAliases() {
  try {
    const response = await fetch(`${API_BASE_URL}/location_aliases?order=alias_norm.asc&limit=1000`);
    if (!response.ok) throw new Error('Failed to fetch location aliases');
    
    const data = await response.json();
    
    return data.map((row: any) => ({
      id: row.alias_norm,
      aliasNorm: row.alias_norm,
      locationId: String(row.location_id),
      status: row.status,
      source: row.source,
      confidence: Number(row.confidence_last),
      hits: row.hits,
      lastUsed: row.last_used,
      createdAt: row.created_at,
      createdBy: row.created_by,
    }));
  } catch (error) {
    console.error('Error fetching location aliases:', error);
    return [];
  }
}

/**
 * Get automation statistics
 */
export async function getAutomationStats() {
  try {
    const [logs, events, emailStats, triage] = await Promise.all([
      fetchOrdersLog(),
      fetchOrderEvents(),
      fetchEmailStats(),
      fetchEmailTriage(),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const logsToday = logs.filter((l) => new Date(l.createdAt) >= today);
    const emailsToday = emailStats.filter((e) => new Date(e.receivedAt) >= today);
    const triageToday = triage.filter((t) => new Date(t.createdAt) >= today);
    
    const successfulSteps = logsToday.filter((l) => l.status === 'OK').length;
    const errorSteps = logsToday.filter((l) => l.status === 'ERROR').length;
    const warnSteps = logsToday.filter((l) => l.status === 'WARN').length;
    
    const orderEmails = triageToday.filter((t) => t.isOrderEmail).length;
    const nonOrderEmails = triageToday.length - orderEmails;
    
    return {
      emailsProcessedToday: emailsToday.length,
      orderEmailsToday: orderEmails,
      nonOrderEmailsToday: nonOrderEmails,
      automationStepsToday: logsToday.length,
      successfulSteps,
      errorSteps,
      warnSteps,
      automationSuccessRate: logsToday.length > 0 ? (successfulSteps / logsToday.length) * 100 : 100,
      eventsToday: events.filter((e) => new Date(e.createdAt) >= today).length,
    };
  } catch (error) {
    console.error('Error getting automation stats:', error);
    return {
      emailsProcessedToday: 0,
      orderEmailsToday: 0,
      nonOrderEmailsToday: 0,
      automationStepsToday: 0,
      successfulSteps: 0,
      errorSteps: 0,
      warnSteps: 0,
      automationSuccessRate: 100,
      eventsToday: 0,
    };
  }
}
