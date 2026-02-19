/**
 * Orders Service - Fetches real data from PostgREST API (bvg schema)
 */

import type { OrderIntake, DLQOrder, DashboardKPIs, Holiday, Location, LocationSuggestion, Client } from '@/types';
import { API_BASE_URL, bvgFetch } from './api';

/**
 * Fetch orders from ordenes_intake table (bvg schema)
 * Gets real client names via separate customer_stg lookup
 */
export async function fetchOrders(): Promise<OrderIntake[]> {
  try {
    // Fetch orders, clients, and line counts in parallel
    const [ordersResponse, clientsMap, lineCountsMap] = await Promise.all([
      bvgFetch(`${API_BASE_URL}/ordenes_intake?order=created_at.desc&limit=200`),
      fetchClientsMap(), // Client ID -> Name lookup
      fetchLineCountsMap() // Order ID -> Lines count lookup
    ]);

    if (!ordersResponse.ok) throw new Error('Failed to fetch orders');

    const ordersData = await ordersResponse.json();

    // Map database fields to frontend types with real client names and line counts
    return ordersData.map((row: any) => {
      const hasClient = row.client_id != null;
      return {
      id: String(row.id),
      orderCode: row.order_code || `ORD-${row.id}`,
      messageId: row.message_id || '',
      conversationId: row.conversation_id || '',
      clientId: hasClient ? String(row.client_id) : '',
      // M03: Use real client name from lookup; "Sin asignar" when client_id is null
      clientName: hasClient ? (clientsMap[row.client_id] || `Cliente ${row.client_id}`) : 'Sin asignar',
      senderAddress: row.sender_address || '',
      subject: row.subject || 'Sin asunto',
      status: row.status,
      // Usar created_at para la hora real de recepción (order_date solo tiene fecha)
      receivedAt: row.created_at,
      processedAt: row.updated_at,
      // Get real line count from materialized view
      linesCount: lineCountsMap[row.id] || 0,
    };
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
}

/**
 * Fetch a map of intake_id -> lines_count from materialized view
 */
async function fetchLineCountsMap(): Promise<Record<string, number>> {
  try {
    const response = await bvgFetch(`${API_BASE_URL}/order_line_counts?select=intake_id,lines_count`);
    if (!response.ok) return {};

    const data = await response.json();
    const map: Record<string, number> = {};
    data.forEach((row: any) => {
      map[String(row.intake_id)] = Number(row.lines_count) || 0;
    });
    return map;
  } catch {
    return {};
  }
}

/**
 * Fetch a map of client_id -> description for quick lookup
 * Handles zero-padded IDs (e.g., '00006' maps to both '00006' and '6')
 */
async function fetchClientsMap(): Promise<Record<string, string>> {
  try {
    const response = await bvgFetch(`${API_BASE_URL}/customer_stg?select=id,description&limit=3000`);
    if (!response.ok) return {};

    const clients = await response.json();
    const map: Record<string, string> = {};
    clients.forEach((c: any) => {
      const description = c.description || `Cliente ${c.id}`;
      // Store with original ID (e.g., '00006')
      map[c.id] = description;
      // Also store with numeric ID (e.g., '6') for matching
      const numericId = parseInt(c.id, 10);
      if (!isNaN(numericId)) {
        map[String(numericId)] = description;
      }
    });
    return map;
  } catch {
    return {};
  }
}

/**
 * Get full client info including default load location
 * Returns client details and their default pickup/load location
 */
export interface ClientWithDefaultLocation {
  id: string;
  name: string;
  address?: string;
  city?: string;
  region?: string;
  defaultLoadLocation?: {
    id: string;
    name: string;
    address: string;
    city: string;
    region: string;
    zipCode: string;
  };
}

export async function fetchClientWithDefaultLocation(clientId: string): Promise<ClientWithDefaultLocation | null> {
  try {
    // Pad client ID to match database format (e.g., 6 -> 00006)
    const paddedId = clientId.padStart(5, '0');
    console.log('[fetchClientWithDefaultLocation] paddedId:', paddedId);
    
    // Fetch client info
    const clientResponse = await bvgFetch(
      `${API_BASE_URL}/customer_stg?id=eq.${paddedId}&select=id,description,address,location,region`
    );
    
    console.log('[fetchClientWithDefaultLocation] clientResponse.ok:', clientResponse.ok);
    if (!clientResponse.ok) return null;
    const clients = await clientResponse.json();
    console.log('[fetchClientWithDefaultLocation] clients:', clients);
    if (clients.length === 0) return null;
    
    const client = clients[0];
    
    // Fetch default location
    const defaultLocResponse = await bvgFetch(
      `${API_BASE_URL}/customer_default_location?customer_id=eq.${paddedId}&select=location_id`
    );
    
    let defaultLoadLocation = undefined;
    
    console.log('[fetchClientWithDefaultLocation] defaultLocResponse.ok:', defaultLocResponse.ok);
    if (defaultLocResponse.ok) {
      const defaultLocs = await defaultLocResponse.json();
      console.log('[fetchClientWithDefaultLocation] defaultLocs:', defaultLocs);
      if (defaultLocs.length > 0) {
        const locationId = defaultLocs[0].location_id;
        console.log('[fetchClientWithDefaultLocation] locationId:', locationId);
        
        // Fetch location details
        const locResponse = await bvgFetch(
          `${API_BASE_URL}/customer_location_stg?id=eq.${locationId}&select=id,description,address,zip_code,location,region`
        );
        
        if (locResponse.ok) {
          const locations = await locResponse.json();
          if (locations.length > 0) {
            const loc = locations[0];
            defaultLoadLocation = {
              id: String(loc.id),
              name: loc.description || 'Sin nombre',
              address: loc.address || '',
              city: loc.location || '',
              region: loc.region || '',
              zipCode: loc.zip_code || '',
            };
          }
        }
      }
    }
    
    return {
      id: client.id,
      name: client.description || `Cliente ${client.id}`,
      address: client.address,
      city: client.location,
      region: client.region,
      defaultLoadLocation,
    };
  } catch (error) {
    console.error('Error fetching client with default location:', error);
    return null;
  }
}

/**
 * Save or update the default load location for a customer
 * Uses upsert: inserts if not exists, updates if exists
 */
export async function saveCustomerDefaultLoadLocation(
  customerId: string,
  locationId: number
): Promise<{ success: boolean; message: string }> {
  try {
    const paddedId = customerId.padStart(5, '0');

    const response = await bvgFetch(`${API_BASE_URL}/customer_default_location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        customer_id: paddedId,
        location_id: locationId,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    return { success: true, message: 'Ubicación de carga predeterminada guardada correctamente' };
  } catch (error) {
    console.error('Error saving default load location:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al guardar ubicación de carga',
    };
  }
}

/**
 * Clear the default load location for a customer
 */
export async function clearCustomerDefaultLoadLocation(
  customerId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const paddedId = customerId.padStart(5, '0');

    const response = await bvgFetch(
      `${API_BASE_URL}/customer_default_location?customer_id=eq.${paddedId}`,
      {
        method: 'DELETE',
        headers: { 'Prefer': 'return=minimal' },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    return { success: true, message: 'Ubicación de carga predeterminada eliminada' };
  } catch (error) {
    console.error('Error clearing default load location:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al eliminar ubicación de carga',
    };
  }
}

/**
 * Fetch order lines for a specific order from ordenes_intake_lineas
 * Includes lookup for destination name from customer_location_stg
 */
// Interface for full location data
interface LocationData {
  name: string;
  address?: string;
  city?: string;
  province?: string;
  zipCode?: string;
}

export async function fetchOrderLines(intakeId: string): Promise<any[]> {
  try {
    const response = await bvgFetch(
      `${API_BASE_URL}/ordenes_intake_lineas?intake_id=eq.${intakeId}&order=id.asc`
    );
    if (!response.ok) return [];

    const lines = await response.json();

    // Get destination IDs to fetch location details
    const destIds = lines
      .map((row: any) => row.destination_id)
      .filter((id: any) => id != null);
    const originIds = lines
      .map((row: any) => row.origin_id)
      .filter((id: any) => id != null);
    const allLocIds = [...new Set([...destIds, ...originIds])];

    // Fetch full location data (destinations + load points)
    let locationsMap: Record<string, LocationData> = {};
    if (allLocIds.length > 0) {
      const locResponse = await bvgFetch(
        `${API_BASE_URL}/customer_location_stg?id=in.(${allLocIds.join(',')})`
      );
      if (locResponse.ok) {
        const locations = await locResponse.json();
        locations.forEach((loc: any) => {
          locationsMap[String(loc.id)] = {
            name: loc.description || loc.location || 'Sin nombre',
            address: loc.address,
            city: loc.location,
            province: loc.region,
            zipCode: loc.zip_code,
          };
        });
      }
    }

    return lines.map((row: any, index: number) => {
      const locationData = locationsMap[String(row.destination_id)];
      const loadPointData = locationsMap[String(row.origin_id)];
      
      return {
        id: String(row.id),
        lineNumber: index + 1,
        customer: row.customer_name || 'Sin cliente',
        destination: locationData?.name || row.raw_destination_text || 'Sin destino',
        destinationId: row.destination_id,
        destinationAddress: locationData?.address,
        destinationCity: locationData?.city,
        destinationProvince: locationData?.province,
        destinationZipCode: locationData?.zipCode,
        notes: row.line_notes || '',
        pallets: Number(row.pallets) || 0,
        deliveryDate: row.delivery_date,
        observations: '',
        unit: row.pallet_type || 'PLT',
        locationStatus: row.location_status || (row.destination_id ? 'AUTO' : 'PENDING_LOCATION'),
        locationSuggestions: row.location_suggestions || [],
        rawDestinationText: row.raw_destination_text,
        rawCustomerText: row.raw_customer_text,
        loadPoint: loadPointData?.name,
        loadPointId: row.origin_id,
        loadPointAddress: loadPointData?.address,
        rawLoadPoint: row.raw_load_point,
        locationSetBy: row.location_set_by,
        locationSetAt: row.location_set_at,
        anulada: row.anulada === true,
        anuladaAt: row.anulada_at,
        anuladaPor: row.anulada_por,
      };
    });
  } catch (error) {
    console.error('Error fetching order lines:', error);
    return [];
  }
}


/**
 * Fetch DLQ orders from bvg.dlq_orders
 */
export async function fetchDLQOrders(): Promise<DLQOrder[]> {
  try {
    const response = await bvgFetch(`${API_BASE_URL}/dlq_orders?order=created_at.desc&limit=100`);
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
    const response = await bvgFetch(`${API_BASE_URL}/holidays?order=date.asc`);
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
 * Fixed: Now limits avgProcessingTime calculation to last 7 days
 */
export async function fetchDashboardKPIs(): Promise<DashboardKPIs> {
  try {
    // Fetch orders, DLQ, and pending locations in parallel
    const [orders, dlqOrders, pendingLocationsResponse] = await Promise.all([
      fetchOrders(),
      fetchDLQOrders(),
      bvgFetch(`${API_BASE_URL}/ordenes_intake_lineas?location_status=eq.PENDING_LOCATION&anulada=neq.true&select=id`),
    ]);

    // Parse pending locations count
    let pendingLocations = 0;
    if (pendingLocationsResponse.ok) {
      const pendingData = await pendingLocationsResponse.json();
      pendingLocations = Array.isArray(pendingData) ? pendingData.length : 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Orders by time period
    const ordersToday = orders.filter((o) => new Date(o.receivedAt) >= today).length;
    const ordersYesterday = orders.filter((o) => {
      const date = new Date(o.receivedAt);
      return date >= yesterday && date < today;
    }).length;
    const ordersWeek = orders.filter((o) => new Date(o.receivedAt) >= weekAgo).length;
    
    // DLQ count
    const pendingDLQ = dlqOrders.filter((o) => !o.resolved).length;

    // Orders by status (using correct UPPERCASE status values)
    const ordersInValidation = orders.filter((o) => 
      o.status === 'VALIDATING' || o.status === 'IN_REVIEW'
    ).length;
    const ordersProcessing = orders.filter((o) => o.status === 'PROCESSING').length;
    const ordersReceived = orders.filter((o) => o.status === 'RECEIVED').length;
    const ordersRejected = orders.filter((o) => o.status === 'REJECTED').length;
    const ordersCompleted = orders.filter((o) => o.status === 'COMPLETED').length;

    // Calculate average processing time for today's completed orders
    const calculateAvgTime = (ordersList: typeof orders, startDate: Date, endDate?: Date) => {
      const completed = ordersList.filter((o) => {
        const receivedDate = new Date(o.receivedAt);
        const inRange = endDate 
          ? receivedDate >= startDate && receivedDate < endDate
          : receivedDate >= startDate;
        return (o.status === 'PROCESSING' || o.status === 'COMPLETED') 
          && o.processedAt 
          && inRange;
      });

      if (completed.length === 0) return 0;

      const validTimes: number[] = [];
      for (const o of completed) {
        const start = new Date(o.receivedAt).getTime();
        const end = new Date(o.processedAt!).getTime();
        const diffMs = end - start;
        if (diffMs > 0 && diffMs < 24 * 60 * 60 * 1000) {
          validTimes.push(diffMs);
        }
      }
      
      if (validTimes.length === 0) return 0;
      const totalTimeMs = validTimes.reduce((acc, t) => acc + t, 0);
      const avgMinutes = (totalTimeMs / validTimes.length) / 60000;
      return avgMinutes < 1 ? parseFloat(avgMinutes.toFixed(1)) : Math.round(avgMinutes);
    };

    const avgProcessingTime = calculateAvgTime(orders, weekAgo);
    const avgProcessingTimeYesterday = calculateAvgTime(orders, yesterday, today);

    // Calculate success rate based on orders that completed vs errored in last 7 days
    const erroredOrdersWeek = orders.filter((o) => {
      const receivedDate = new Date(o.receivedAt);
      return receivedDate >= weekAgo && o.status === 'ERROR';
    }).length;

    const successRate = ordersWeek > 0 
      ? ((ordersWeek - erroredOrdersWeek - pendingDLQ) / ordersWeek) * 100 
      : 100;

    return {
      ordersToday,
      ordersYesterday,
      ordersWeek,
      errorRate: ordersWeek > 0 ? ((erroredOrdersWeek + pendingDLQ) / ordersWeek) * 100 : 0,
      pendingDLQ,
      avgProcessingTime,
      avgProcessingTimeYesterday,
      successRate: Math.max(0, Math.min(100, successRate)),
      // New operational metrics
      pendingLocations,
      ordersInValidation,
      ordersProcessing,
      ordersReceived,
      ordersRejected,
      ordersCompleted,
    };
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    return {
      ordersToday: 0,
      ordersYesterday: 0,
      ordersWeek: 0,
      errorRate: 0,
      pendingDLQ: 0,
      avgProcessingTime: 0,
      avgProcessingTimeYesterday: 0,
      successRate: 100,
      pendingLocations: 0,
      ordersInValidation: 0,
      ordersProcessing: 0,
      ordersReceived: 0,
      ordersRejected: 0,
      ordersCompleted: 0,
    };
  }
}


/**
 * Search clients by name, code or company_code (debounced search box)
 * Similar to searchLocations - returns clients matching the query
 */
export async function searchClients(query: string, limit: number = 15): Promise<Client[]> {
  try {
    if (!query || query.length < 2) return [];

    const encoded = encodeURIComponent(`%${query}%`);
    const response = await bvgFetch(
      `${API_BASE_URL}/customer_stg?or=(description.ilike.${encoded},id.ilike.${encoded},company_code.ilike.${encoded})&is_enable=eq.true&limit=${limit}&order=description.asc`
    );

    if (!response.ok) return [];

    const data = await response.json();
    return data.map((row: any) => ({
      id: row.id,
      code: row.id,
      name: row.description || row.id,
      email: '',
      active: row.is_enable !== false,
      createdAt: row.imported_at || '',
      updatedAt: row.imported_at || '',
      companyCode: row.company_code,
      type: row.type,
      address: row.address,
      location: row.location,
      country: row.country,
    }));
  } catch (error) {
    console.error('Error searching clients:', error);
    return [];
  }
}

/**
 * Fetch clients from customer_stg table
 */
export async function fetchClients() {
  try {
    const response = await bvgFetch(`${API_BASE_URL}/customer_stg?order=description.asc`);
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
    const response = await bvgFetch(`${API_BASE_URL}/customer_emails?order=customer_id.asc`);
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

export interface CustomerEmailWithClient {
  id: string;
  customerId: string;
  clientName: string;
  clientCode: string;
  email: string;
  emailType: string;
  active: boolean;
  createdAt: string;
}

/**
 * Fetch customer emails with client name (merged from customer_stg)
 */
export async function fetchCustomerEmailsWithClients(): Promise<CustomerEmailWithClient[]> {
  try {
    const [emailsRes, clientsRes] = await Promise.all([
      bvgFetch(`${API_BASE_URL}/customer_emails?order=customer_id.asc&select=id,customer_id,email,email_type,active,created_at`),
      bvgFetch(`${API_BASE_URL}/customer_stg?select=id,description`),
    ]);
    if (!emailsRes.ok) throw new Error('Failed to fetch customer emails');
    if (!clientsRes.ok) throw new Error('Failed to fetch clients');

    const emails = await emailsRes.json();
    const clients = await clientsRes.json();
    const clientMap = new Map(clients.map((c: any) => [String(c.id), { name: c.description || c.id, code: c.id }]));

    return emails.map((row: any) => {
      const c = clientMap.get(String(row.customer_id)) || { name: row.customer_id, code: row.customer_id };
      return {
        id: String(row.id),
        customerId: row.customer_id,
        clientName: c.name,
        clientCode: c.code,
        email: row.email,
        emailType: row.email_type || 'PRIMARY',
        active: row.active !== false,
        createdAt: row.created_at,
      };
    });
  } catch (error) {
    console.error('Error fetching customer emails with clients:', error);
    return [];
  }
}

// ========== NEW MONITORING FUNCTIONS ==========

/**
 * Fetch email statistics from ordenes_intake, enriched with:
 * 1) email_intake_stats (adjuntos para no-pedidos; puede estar vacío)
 * 2) email_triage.triage_output.sources (fallback: inferir PDF/Excel desde has_relevant del triaje)
 *
 * Prioridad: stats > payload/file_uri > email_triage.sources
 */
export async function fetchEmailStats() {
  try {
    const [intakeRes, statsRes, triageRes] = await Promise.all([
      bvgFetch(
        `${API_BASE_URL}/ordenes_intake?order=created_at.desc&limit=200&select=id,message_id,sender_address,subject,customer_name,created_at,status,source,payload_json,file_uri`
      ),
      bvgFetch(
        `${API_BASE_URL}/email_intake_stats?order=received_at.desc&limit=500&select=message_id,has_attachments,attachments_total,attachments_pdf,attachments_excel,attachments_other`
      ).catch(() => null),
      bvgFetch(
        `${API_BASE_URL}/email_triage?order=created_at.desc&limit=500&select=message_id,triage_output,output`
      ).catch(() => null),
    ]);

    if (!intakeRes.ok) {
      console.error('Failed to fetch ordenes_intake:', intakeRes.status);
      throw new Error('Failed to fetch email stats');
    }

    const data = await intakeRes.json();
    const statsList = statsRes?.ok ? await statsRes.json() : [];
    const triageList = triageRes?.ok ? await triageRes.json() : [];

    const statsByMsgId = new Map<string, { has_attachments: boolean; attachments_pdf: number; attachments_excel: number; attachments_other: number }>();
    for (const s of statsList) {
      if (s?.message_id) statsByMsgId.set(s.message_id, s);
    }

    const triageByMsgId = new Map<string, { sources?: { pdf?: { has_relevant?: unknown }; excel?: { has_relevant?: unknown } }; preferred_source?: string }>();
    for (const t of triageList) {
      if (t?.message_id) {
        const out = t.triage_output || t.output || {};
        triageByMsgId.set(t.message_id, {
          sources: out.sources,
          preferred_source: out.preferred_source,
        });
      }
    }

    const isRelevant = (v: unknown): boolean =>
      v === true || v === 'true';

    return data.map((row: any) => {
      const stats = row.message_id ? statsByMsgId.get(row.message_id) : null;
      let attachmentsPdf = stats?.attachments_pdf ?? 0;
      let attachmentsExcel = stats?.attachments_excel ?? 0;
      let attachmentsOther = stats?.attachments_other ?? 0;
      let hasAttachments = stats?.has_attachments ?? false;

      if (!stats) {
        const payload = row.payload_json || {};
        const attachments = payload.attachments || payload.files || [];
        if (row.file_uri && row.file_uri !== 'NA' && row.file_uri !== '') {
          hasAttachments = true;
          const fileUri = row.file_uri.toLowerCase();
          if (fileUri.includes('.pdf')) attachmentsPdf = 1;
          else if (fileUri.includes('.xls') || fileUri.includes('.csv')) attachmentsExcel = 1;
          else attachmentsOther = 1;
        }
        if (Array.isArray(attachments) && attachments.length > 0) {
          hasAttachments = true;
          attachments.forEach((att: any) => {
            const filename = (att.filename || att.name || '').toLowerCase();
            const mimeType = (att.mimeType || att.contentType || '').toLowerCase();
            if (filename.endsWith('.pdf') || mimeType.includes('pdf')) attachmentsPdf++;
            else if (filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.csv') || mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) attachmentsExcel++;
            else if (filename || mimeType) attachmentsOther++;
          });
        }
      }

      if (attachmentsPdf === 0 && attachmentsExcel === 0 && attachmentsOther === 0 && row.message_id) {
        const triage = triageByMsgId.get(row.message_id);
        const sources = triage?.sources;
        const pref = triage?.preferred_source;
        if (sources) {
          if (isRelevant(sources.pdf?.has_relevant)) {
            attachmentsPdf = 1;
            hasAttachments = true;
          }
          if (isRelevant(sources.excel?.has_relevant)) {
            attachmentsExcel = 1;
            hasAttachments = true;
          }
        }
        if (attachmentsPdf === 0 && attachmentsExcel === 0 && pref) {
          if (pref === 'pdf') {
            attachmentsPdf = 1;
            hasAttachments = true;
          } else if (pref === 'excel') {
            attachmentsExcel = 1;
            hasAttachments = true;
          }
        }
      }

      const fromAddress = row.sender_address || '';
      const fromDomain = fromAddress.includes('@') ? fromAddress.split('@')[1] : '';

      return {
        id: String(row.id),
        receivedAt: row.created_at,
        messageId: row.message_id,
        fromAddress,
        fromDomain,
        subject: row.subject || '(Sin asunto)',
        hasAttachments,
        attachmentsPdf,
        attachmentsExcel,
        attachmentsOther,
        customerName: row.customer_name,
        status: row.status,
        source: row.source || 'EMAIL',
        isProcessedAsOrder: true,
      };
    });
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


    const response = await bvgFetch(url);
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
    const response = await bvgFetch(`${API_BASE_URL}/order_events?order=created_at.desc&limit=100`);
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
 * Fetch UNKNOWN_CLIENT events (remitentes no reconocidos)
 * Excludes events with event_data.dismissed === true
 */
export async function fetchUnknownClientEvents(limit = 50): Promise<UnknownClientEvent[]> {
  try {
    const response = await bvgFetch(
      `${API_BASE_URL}/order_events?event_type=eq.UNKNOWN_CLIENT&order=created_at.desc&limit=${limit * 2}`
    );
    if (!response.ok) throw new Error('Failed to fetch unknown client events');

    const data = await response.json();
    return data
      .filter((row: any) => !row.event_data?.dismissed)
      .slice(0, limit)
      .map((row: any) => ({
        id: String(row.id),
        eventData: row.event_data || {},
        createdAt: row.created_at,
        senderAddress: row.event_data?.sender_address || '',
        subject: row.event_data?.subject || '',
        receivedAt: row.event_data?.received_at || row.created_at,
      }));
  } catch (error) {
    console.error('Error fetching unknown client events:', error);
    return [];
  }
}

/**
 * Dismiss an UNKNOWN_CLIENT event (mark as discarded, won't show in list)
 */
export async function dismissUnknownClientEvent(
  eventId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const getRes = await bvgFetch(`${API_BASE_URL}/order_events?id=eq.${eventId}&select=event_data`);
    if (!getRes.ok) throw new Error('Failed to fetch event');
    const rows = await getRes.json();
    const current = rows[0]?.event_data || {};
    const merged = { ...current, dismissed: true };

    const patchRes = await bvgFetch(
      `${API_BASE_URL}/order_events?id=eq.${eventId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ event_data: merged }),
      }
    );
    if (!patchRes.ok) {
      const err = await patchRes.text();
      throw new Error(err || `HTTP ${patchRes.status}`);
    }
    return { success: true, message: 'Evento descartado' };
  } catch (error) {
    console.error('Error dismissing event:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al descartar',
    };
  }
}

export interface UnknownClientEvent {
  id: string;
  eventData: Record<string, unknown>;
  createdAt: string;
  senderAddress: string;
  subject: string;
  receivedAt: string;
}

/**
 * Fallback: fetch sender/subject when ordenes_intake has them empty.
 * Tries: 1) order_events (UNKNOWN_CLIENT), 2) email_triage by message_id, 3) email_triage by conversation_id.
 */
export async function fetchSenderFallbackForOrder(
  messageId: string,
  conversationId?: string
): Promise<{ senderAddress: string; subject: string }> {
  if (!messageId) return { senderAddress: '', subject: '' };

  const empty = { senderAddress: '', subject: '' };
  const extractFrom = (ed: Record<string, unknown> | null) => {
    if (!ed) return empty;
    const sender =
      (ed.sender_address as string) ||
      (ed.from as string) ||
      (typeof (ed.from as any)?.emailAddress?.address === 'string' ? (ed.from as any).emailAddress.address : '') ||
      '';
    const subj = (ed.subject as string) || '';
    return { senderAddress: sender || '', subject: subj || '' };
  };
  const extractFromRow = (row: any): { senderAddress: string; subject: string } => {
    if (!row) return empty;
    let sender = row.sender_address || row.from_email || row.from || '';
    if (!sender && row.payload) {
      const p = row.payload as Record<string, unknown>;
      sender =
        (p.sender_address as string) ||
        (p.from as string) ||
        (typeof (p.from as any)?.emailAddress?.address === 'string' ? (p.from as any).emailAddress.address : '') ||
        (p.from_email as string) ||
        '';
    }
    const subj = row.subject || '';
    return { senderAddress: String(sender || ''), subject: String(subj || '') };
  };

  // 1) order_events UNKNOWN_CLIENT
  try {
    const evRes = await bvgFetch(
      `${API_BASE_URL}/order_events?event_type=eq.UNKNOWN_CLIENT&order=created_at.desc&limit=50`
    );
    if (evRes.ok) {
      const evData = await evRes.json();
      const match = evData.find((row: any) => {
        const ed = row?.event_data || {};
        const mid = ed.message_id || ed.messageId || '';
        return String(mid) === String(messageId);
      });
      const fromEv = extractFrom(match?.event_data as Record<string, unknown>);
      if (fromEv.senderAddress || fromEv.subject) return fromEv;
    }
  } catch {
    /* ignore */
  }

  // 2) email_triage by message_id
  if (messageId) {
    try {
      const etRes = await bvgFetch(
        `${API_BASE_URL}/email_triage?message_id=eq.${encodeURIComponent(messageId)}&limit=1`
      );
      if (etRes.ok) {
        const etData = await etRes.json();
        const row = etData[0];
        const result = extractFromRow(row);
        if (result.senderAddress || result.subject) return result;
      }
    } catch {
      /* fall through */
    }
  }

  // 3) Fallback: email_triage por conversation_id (formatos message_id distintos)
  if (conversationId && conversationId.trim()) {
    try {
      const etRes = await bvgFetch(
        `${API_BASE_URL}/email_triage?conversation_id=eq.${encodeURIComponent(conversationId)}&order=created_at.desc&limit=1`
      );
      if (etRes.ok) {
        const etData = await etRes.json();
        const row = etData[0];
        const result = extractFromRow(row);
        if (result.senderAddress || result.subject) return result;
      }
    } catch {
      /* ignore */
    }
  }

  return empty;
}

/**
 * Fetch email summary for order detail.
 * Prefers operator_summary (AI Triage, orientado al operador) over reason (técnico).
 * ordenes_intake.message_id suele estar en formato Internet; email_triage.message_id en formato Graph.
 * Usamos conversation_id como fallback porque coincide en ambas tablas.
 */
export async function fetchEmailTriageReason(
  messageId: string,
  conversationId?: string
): Promise<string | null> {
  // 1) Buscar por message_id
  if (messageId) {
    try {
      const response = await bvgFetch(
        `${API_BASE_URL}/email_triage?message_id=eq.${encodeURIComponent(messageId)}&select=reason,output&limit=1`
      );
      if (response.ok) {
        const data = await response.json();
        const row = Array.isArray(data) ? data[0] : null;
        if (row) {
          const opSummary = row?.output?.operator_summary;
          if (typeof opSummary === 'string' && opSummary.trim()) return opSummary.trim();
          const reason = row?.reason;
          if (typeof reason === 'string' && reason.trim()) return reason.trim();
        }
      }
    } catch {
      /* fall through to conversation_id */
    }
  }

  // 2) Fallback por conversation_id (mismo hilo, formatos message_id distintos)
  if (conversationId && conversationId.trim()) {
    try {
      const response = await bvgFetch(
        `${API_BASE_URL}/email_triage?conversation_id=eq.${encodeURIComponent(conversationId)}&select=reason,output&order=created_at.desc&limit=1`
      );
      if (response.ok) {
        const data = await response.json();
        const row = Array.isArray(data) ? data[0] : null;
        if (row) {
          const opSummary = row?.output?.operator_summary;
          if (typeof opSummary === 'string' && opSummary.trim()) return opSummary.trim();
          const reason = row?.reason;
          if (typeof reason === 'string' && reason.trim()) return reason.trim();
        }
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

/**
 * Fetch orders without assigned client
 * Optionally excludes intake_ids in dismissedIds (from order_pending_dismissed)
 */
export async function fetchOrdersWithoutClient(
  limit = 50,
  dismissedIds: Set<string> = new Set()
): Promise<OrderWithoutClient[]> {
  try {
    const response = await bvgFetch(
      `${API_BASE_URL}/ordenes_intake?client_id=is.null&order=created_at.desc&limit=${limit * 2}&select=id,order_code,message_id,sender_address,subject,created_at`
    );
    if (!response.ok) throw new Error('Failed to fetch orders without client');

    const data = await response.json();
    return data
      .filter((row: any) => !dismissedIds.has(String(row.id)))
      .slice(0, limit)
      .map((row: any) => ({
        id: String(row.id),
        orderCode: row.order_code || `ORD-${row.id}`,
        messageId: row.message_id || '',
        senderAddress: row.sender_address || '',
        subject: row.subject || '',
        createdAt: row.created_at,
      }));
  } catch (error) {
    console.error('Error fetching orders without client:', error);
    return [];
  }
}

/**
 * Fetch intake_ids that have been dismissed from "Pedidos sin cliente"
 */
export async function fetchDismissedOrderIds(): Promise<Set<string>> {
  try {
    const response = await bvgFetch(
      `${API_BASE_URL}/order_pending_dismissed?select=intake_id`
    );
    if (!response.ok) return new Set();
    const data = await response.json();
    return new Set(data.map((row: any) => String(row.intake_id)));
  } catch {
    return new Set();
  }
}

/**
 * Dismiss an order from "Pedidos sin cliente" (hide from list without assigning)
 */
export async function dismissOrderPending(
  intakeId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await bvgFetch(
      `${API_BASE_URL}/order_pending_dismissed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ intake_id: parseInt(intakeId, 10) }),
      }
    );
    if (!response.ok) {
      if (response.status === 409 || response.status === 23505) {
        return { success: true, message: 'Ya estaba descartado' };
      }
      const err = await response.text();
      throw new Error(err || `HTTP ${response.status}`);
    }
    return { success: true, message: 'Pedido descartado de la lista' };
  } catch (error) {
    console.error('Error dismissing order:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al descartar',
    };
  }
}

export interface OrderWithoutClient {
  id: string;
  orderCode: string;
  messageId: string;
  senderAddress: string;
  subject: string;
  createdAt: string;
}

export type CustomerEmail = {
  id: string;
  customerId: string;
  email: string;
  emailType: string;
  active: boolean;
  createdAt?: string;
};

/**
 * Update customer email (e.g. toggle active)
 */
export async function updateCustomerEmail(
  customerEmailId: string,
  data: { active?: boolean; email?: string; email_type?: string }
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await bvgFetch(
      `${API_BASE_URL}/customer_emails?id=eq.${customerEmailId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          ...(data.active !== undefined && { active: data.active }),
          ...(data.email !== undefined && { email: data.email.trim().toLowerCase() }),
          ...(data.email_type !== undefined && { email_type: data.email_type }),
          updated_at: new Date().toISOString(),
        }),
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }
    return { success: true, message: 'Actualizado correctamente' };
  } catch (error) {
    console.error('Error updating customer email:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al actualizar',
    };
  }
}

/**
 * Add email to customer_emails (link sender to client)
 */
export async function addCustomerEmail(
  customerId: string,
  email: string,
  emailType = 'PRIMARY'
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await bvgFetch(`${API_BASE_URL}/customer_emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        customer_id: customerId,
        email: email.trim().toLowerCase(),
        email_type: emailType,
        active: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 409) {
        return { success: false, message: 'Este email ya está asociado a un cliente' };
      }
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    return { success: true, message: 'Email asociado correctamente al cliente' };
  } catch (error) {
    console.error('Error adding customer email:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al asociar email',
    };
  }
}

/**
 * Assign client to an order (ordenes_intake.client_id)
 */
export async function assignClientToOrder(
  intakeId: string,
  clientId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // client_id in ordenes_intake is BIGINT; customer_stg.id can be '00006' - parse to number
    const numericClientId = clientId.match(/^\d+$/) ? parseInt(clientId, 10) : null;
    if (numericClientId === null || isNaN(numericClientId)) {
      return { success: false, message: 'ID de cliente no válido' };
    }

    const response = await bvgFetch(
      `${API_BASE_URL}/ordenes_intake?id=eq.${intakeId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          client_id: numericClientId,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    return { success: true, message: 'Cliente asignado correctamente al pedido' };
  } catch (error) {
    console.error('Error assigning client to order:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al asignar cliente',
    };
  }
}

/**
 * Fetch email triage data (classification: pedido vs no-pedido)
 * Usa la tabla email_triage con columnas: triage_id, message_id, is_order_email, created_at, reason, etc.
 */
export async function fetchEmailTriage() {
  try {
    const response = await bvgFetch(
      `${API_BASE_URL}/email_triage?order=created_at.desc&limit=500&select=triage_id,message_id,from_email,subject,is_order_email,reason,created_at`
    );
    if (!response.ok) {
      console.warn('email_triage table may not exist or is empty');
      return [];
    }

    const data = await response.json();

    return data.map((row: any) => ({
      id: String(row.triage_id ?? row.id),
      messageId: row.message_id,
      fromEmail: row.from_email,
      subject: row.subject,
      isOrderEmail: row.is_order_email === true,
      reason: row.reason,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error fetching email triage:', error);
    return [];
  }
}

/**
 * Fetch email triage stats for today (total, orders, non-orders, percentage)
 */
export async function fetchEmailTriageStats() {
  const triage = await fetchEmailTriage();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const triageToday = triage.filter((t) => new Date(t.createdAt) >= today);
  const orderEmails = triageToday.filter((t) => t.isOrderEmail).length;
  const nonOrderEmails = triageToday.length - orderEmails;
  const totalToday = triageToday.length;
  const percentOrders = totalToday > 0 ? Math.round((orderEmails / totalToday) * 100) : 0;

  return {
    totalToday,
    orderEmailsToday: orderEmails,
    nonOrderEmailsToday: nonOrderEmails,
    percentOrdersToday: percentOrders,
  };
}

/**
 * Fetch expediciones (shipments)
 */
export async function fetchExpediciones() {
  try {
    const response = await bvgFetch(`${API_BASE_URL}/expediciones?order=delivery_date.desc&limit=100`);
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
    const response = await bvgFetch(`${API_BASE_URL}/customer_location_stg?order=description.asc&limit=500`);
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
    const response = await bvgFetch(`${API_BASE_URL}/location_aliases?order=alias_norm.asc&limit=1000`);
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
 * Fetch locations (staging) to resolve location names
 */
export async function fetchLocationsMap() {
  try {
    const response = await bvgFetch(`${API_BASE_URL}/customer_location_stg?select=id,description,code&limit=2000`);
    if (!response.ok) throw new Error('Failed to fetch locations');
    const data = await response.json();
    const map: Record<string, { name: string; code?: string }> = {};
    data.forEach((row: any) => {
      const key = String(row.id);
      map[key] = { name: row.description || row.code || key, code: row.code };
    });
    return map;
  } catch (error) {
    console.error('Error fetching locations map:', error);
    return {};
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

// ========== ORDER APPROVAL FUNCTIONS ==========

/**
 * Approve order and trigger FTP upload via n8n webhook
 */
export async function approveOrderForFTP(
  intakeId: string,
  approvedBy?: string
): Promise<{ success: boolean; message: string; orderCode?: string }> {
  try {
    // Use relative URL for webhook (nginx proxies to n8n internally)
    // This avoids CORS issues since the request goes to the same origin
    const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || '/webhook';

    const response = await fetch(`${N8N_WEBHOOK_URL}/approve-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intake_id: intakeId,
        approved_by: approvedBy || 'Usuario anónimo (sin sesión)',
        approved_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message || 'Pedido aprobado y enviado correctamente',
      orderCode: result.order_code,
    };
  } catch (error) {
    console.error('Error approving order for FTP:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error desconocido al aprobar pedido',
    };
  }
}

// ========== ORDER STATUS MANAGEMENT FUNCTIONS ==========

/**
 * Update order status manually
 * Valid transitions depend on current state
 */
export async function updateOrderStatus(
  intakeId: string,
  newStatus: 'RECEIVED' | 'VALIDATING' | 'IN_REVIEW' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'ERROR',
  reason?: string,
  updatedBy?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Update the order status directly
    const updateData: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Set timestamps based on status
    if (newStatus === 'APPROVED') {
      updateData.approved_at = new Date().toISOString();
    } else if (newStatus === 'REJECTED') {
      updateData.rejected_at = new Date().toISOString();
    } else if (newStatus === 'COMPLETED') {
      updateData.sent_at = new Date().toISOString();
    }

    const response = await bvgFetch(
      `${API_BASE_URL}/ordenes_intake?id=eq.${intakeId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    // Log the status change
    await logOrderEvent(intakeId, 'status_change', {
      new_status: newStatus,
      reason: reason || 'Manual status change',
      updated_by: updatedBy || 'frontend_user',
    });

    return {
      success: true,
      message: `Estado actualizado a ${newStatus}`,
    };
  } catch (error) {
    console.error('Error updating order status:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al actualizar estado',
    };
  }
}

/**
 * Mark order as completed
 */
export async function markOrderCompleted(
  intakeId: string,
  completedBy?: string
): Promise<{ success: boolean; message: string }> {
  return updateOrderStatus(intakeId, 'COMPLETED', 'Marcado como completado manualmente', completedBy);
}

/**
 * Reject/Cancel an order
 */
export async function rejectOrder(
  intakeId: string,
  reason: string,
  rejectedBy?: string
): Promise<{ success: boolean; message: string }> {
  return updateOrderStatus(intakeId, 'REJECTED', reason, rejectedBy);
}

/**
 * Move order back to review
 */
export async function moveOrderToReview(
  intakeId: string,
  reason?: string,
  movedBy?: string
): Promise<{ success: boolean; message: string }> {
  return updateOrderStatus(intakeId, 'IN_REVIEW', reason || 'Movido a revisión para verificación', movedBy);
}

/**
 * Log an order event to orders_log
 */
async function logOrderEvent(
  intakeId: string,
  step: string,
  info: Record<string, any>
): Promise<void> {
  try {
    // Get the message_id from the order
    const orderResponse = await bvgFetch(
      `${API_BASE_URL}/ordenes_intake?id=eq.${intakeId}&select=message_id`
    );
    
    if (!orderResponse.ok) return;
    
    const orders = await orderResponse.json();
    const messageId = orders[0]?.message_id || `intake-${intakeId}`;

    await bvgFetch(`${API_BASE_URL}/orders_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intake_id: parseInt(intakeId),
        message_id: messageId,
        step,
        status: 'OK',
        info,
      }),
    });
  } catch (error) {
    console.error('Error logging order event:', error);
  }
}

// ========== SYSTEM HEALTH CHECK FUNCTIONS ==========

/**
 * Check n8n health status
 * Note: Direct browser fetch to n8n will fail due to CORS.
 * We infer n8n health from recent workflow activity in orders_log instead.
 */
export async function checkN8nHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  message: string;
  responseTime?: number;
  details?: any;
}> {
  try {
    // Instead of direct fetch (blocked by CORS), check recent n8n activity via orders_log
    const logs = await fetchOrdersLog();
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Check for recent activity
    const recentLogs = logs.filter((l) => new Date(l.createdAt) >= fiveMinutesAgo);
    const lastHourLogs = logs.filter((l) => new Date(l.createdAt) >= oneHourAgo);
    const recentErrors = lastHourLogs.filter((l) => l.status === 'ERROR');

    if (recentLogs.length > 0) {
      // n8n has been active in the last 5 minutes
      const errorRate = lastHourLogs.length > 0 
        ? (recentErrors.length / lastHourLogs.length) * 100 
        : 0;

      if (errorRate > 50) {
        return {
          status: 'degraded',
          message: `n8n activo pero con alta tasa de errores (${errorRate.toFixed(0)}%)`,
        };
      }

      return {
        status: 'healthy',
        message: `n8n activo (${recentLogs.length} eventos en últimos 5 min)`,
      };
    } else if (lastHourLogs.length > 0) {
      // Activity in the last hour but not in last 5 minutes
      return {
        status: 'healthy',
        message: `n8n sin actividad reciente (${lastHourLogs.length} eventos en última hora)`,
      };
    } else {
      // No activity in the last hour - could be idle or down
      return {
        status: 'unknown',
        message: 'Sin actividad en la última hora (puede estar inactivo)',
      };
    }
  } catch (error) {
    return {
      status: 'unknown',
      message: 'No se puede verificar estado de n8n',
    };
  }
}

/**
 * Check PostgreSQL/PostgREST health
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'down';
  message: string;
  responseTime?: number;
}> {
  const startTime = Date.now();

  try {
    const response = await bvgFetch(`${API_BASE_URL}/ordenes_intake?select=id&limit=1`);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        status: 'healthy',
        message: 'Base de datos operativa',
        responseTime,
      };
    } else {
      return {
        status: 'degraded',
        message: `Base de datos responde con estado ${response.status}`,
        responseTime,
      };
    }
  } catch (error) {
    return {
      status: 'down',
      message: 'Base de datos no disponible',
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Get comprehensive system health status
 */
export async function getSystemHealthStatus(): Promise<{
  overall: 'healthy' | 'degraded' | 'down' | 'unknown';
  services: {
    n8n: { status: string; message: string; responseTime?: number };
    database: { status: string; message: string; responseTime?: number };
  };
  lastCheck: string;
}> {
  const [n8nHealth, dbHealth] = await Promise.all([
    checkN8nHealth(),
    checkDatabaseHealth(),
  ]);

  // Determine overall status
  let overall: 'healthy' | 'degraded' | 'down' | 'unknown' = 'healthy';
  
  // Database is critical - if down, system is down
  if (dbHealth.status === 'down') {
    overall = 'down';
  } else if (n8nHealth.status === 'down') {
    overall = 'down';
  } else if (n8nHealth.status === 'degraded' || dbHealth.status === 'degraded') {
    overall = 'degraded';
  } else if (n8nHealth.status === 'unknown') {
    // n8n unknown but DB healthy = likely just idle
    overall = 'healthy';
  }

  return {
    overall,
    services: {
      n8n: n8nHealth,
      database: dbHealth,
    },
    lastCheck: new Date().toISOString(),
  };
}

/**
 * Get processing metrics from orders_log for more accurate stats
 */
export async function getProcessingMetrics(): Promise<{
  avgTimeByStep: Record<string, number>;
  successRateByStep: Record<string, number>;
  totalProcessedToday: number;
  totalErrorsToday: number;
}> {
  try {
    const logs = await fetchOrdersLog();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logsToday = logs.filter((l) => new Date(l.createdAt) >= today);

    // Group by step
    const stepStats: Record<string, { success: number; error: number; times: number[] }> = {};

    for (const log of logsToday) {
      const step = log.step || 'unknown';
      if (!stepStats[step]) {
        stepStats[step] = { success: 0, error: 0, times: [] };
      }

      if (log.status === 'OK' || log.status === 'SUCCESS') {
        stepStats[step].success++;
      } else if (log.status === 'ERROR') {
        stepStats[step].error++;
      }
    }

    // Calculate metrics
    const avgTimeByStep: Record<string, number> = {};
    const successRateByStep: Record<string, number> = {};

    for (const [step, stats] of Object.entries(stepStats)) {
      const total = stats.success + stats.error;
      successRateByStep[step] = total > 0 ? (stats.success / total) * 100 : 100;
    }

    const totalProcessedToday = logsToday.filter((l) => l.status === 'OK' || l.status === 'SUCCESS').length;
    const totalErrorsToday = logsToday.filter((l) => l.status === 'ERROR').length;

    return {
      avgTimeByStep,
      successRateByStep,
      totalProcessedToday,
      totalErrorsToday,
    };
  } catch (error) {
    console.error('Error fetching processing metrics:', error);
    return {
      avgTimeByStep: {},
      successRateByStep: {},
      totalProcessedToday: 0,
      totalErrorsToday: 0,
    };
  }
}

// ========== LOCATION SELECTION FUNCTIONS ==========

/**
 * Search locations using similarity matching
 * Uses the bvg.search_location_suggestions function if available,
 * otherwise falls back to ILIKE search
 */
export async function searchLocations(query: string, limit: number = 15): Promise<Location[]> {
  try {
    if (!query || query.length < 2) return [];

    // Try using the RPC function first (if migration was applied)
    try {
      const rpcResponse = await bvgFetch(
        `${API_BASE_URL}/rpc/search_location_suggestions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p_search_text: query,
            p_limit: limit,
          }),
        }
      );

      if (rpcResponse.ok) {
        const data = await rpcResponse.json();
        return data.map((row: any) => ({
          id: row.id,
          name: row.name,
          address: row.address,
          zipCode: row.zip_code,
          city: row.city,
          province: row.province,
        }));
      }
    } catch {
      // RPC function not available, use fallback
    }

    // Fallback: simple ILIKE search
    const encoded = encodeURIComponent(`%${query}%`);
    const response = await bvgFetch(
      `${API_BASE_URL}/customer_location_stg?or=(description.ilike.${encoded},location.ilike.${encoded})&limit=${limit}&order=description.asc`
    );

    if (!response.ok) return [];

    const data = await response.json();
    return data.map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.description || row.code || String(row.id),
      address: row.address,
      zipCode: row.zip_code,
      city: row.location,
      province: row.region,
      country: row.country,
    }));
  } catch (error) {
    console.error('Error searching locations:', error);
    return [];
  }
}

/**
 * Cancel (anular) an order line - soft delete. Line remains for audit but is excluded from counts and FTP.
 */
export async function cancelOrderLine(
  lineId: string,
  cancelledBy: string = 'frontend_user'
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await bvgFetch(`${API_BASE_URL}/ordenes_intake_lineas?id=eq.${lineId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        anulada: true,
        anulada_at: new Date().toISOString(),
        anulada_por: cancelledBy,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    return { success: true, message: 'Línea anulada correctamente' };
  } catch (error) {
    console.error('Error cancelling order line:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al anular la línea',
    };
  }
}

/**
 * Set the location for an order line manually
 */
export async function setLineLocation(
  lineId: string,
  locationId: number,
  setBy: string = 'frontend_user'
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await bvgFetch(`${API_BASE_URL}/ordenes_intake_lineas?id=eq.${lineId}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        destination_id: locationId,
        location_status: 'MANUALLY_SET',
        location_set_by: setBy,
        location_set_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    return { success: true, message: 'Ubicación actualizada correctamente' };
  } catch (error) {
    console.error('Error setting line location:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al actualizar ubicación',
    };
  }
}

/**
 * Create a location alias for future automatic matching
 */
export async function createLocationAlias(
  aliasText: string,
  locationId: number,
  createdBy: string = 'frontend_user'
): Promise<{ success: boolean; message: string }> {
  try {
    // Normalize the alias (uppercase, trim)
    const normalizedAlias = aliasText.trim().toUpperCase();

    if (!normalizedAlias) {
      return { success: false, message: 'El alias no puede estar vacío' };
    }

    const response = await bvgFetch(`${API_BASE_URL}/location_aliases`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        alias_norm: normalizedAlias,
        location_id: locationId,
        status: 'APPROVED',
        source: 'MANUAL',
        confidence_last: 1.0,
        hits: 0,
        created_by: createdBy,
        created_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      // Check if it's a duplicate
      if (response.status === 409) {
        return { success: false, message: 'Este alias ya existe' };
      }
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    return { success: true, message: 'Alias creado correctamente' };
  } catch (error) {
    console.error('Error creating location alias:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al crear alias',
    };
  }
}

/**
 * Get count of lines pending location selection for an order
 */
export async function getPendingLocationCount(intakeId: string): Promise<number> {
  try {
    const response = await bvgFetch(
      `${API_BASE_URL}/ordenes_intake_lineas?intake_id=eq.${intakeId}&destination_id=is.null&anulada=neq.true&select=id`,
      { headers: { 'Prefer': 'count=exact' } }
    );

    const countHeader = response.headers.get('content-range');
    if (countHeader) {
      const match = countHeader.match(/\/(\d+)/);
      if (match) return parseInt(match[1], 10);
    }

    const data = await response.json();
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Get all pending location lines across all orders (for dashboard)
 */
export async function fetchPendingLocationLines(): Promise<any[]> {
  try {
    const response = await bvgFetch(
      `${API_BASE_URL}/pending_location_lines?order=order_received_at.desc&limit=50`
    );

    if (!response.ok) return [];
    return response.json();
  } catch (error) {
    console.error('Error fetching pending location lines:', error);
    return [];
  }
}

/**
 * Fetch extraction evaluation metrics (feedback, manually set lines, DLQ)
 * Used by Extraction Evaluation operations page
 */
export interface ExtractionMetrics {
  extractionFeedbackTotal: number;
  linesManuallySetTotal: number;
  dlqOrdersTotal: number;
  totalLinesWithDestination: number;
  correctionRatePct: number | null;
}

async function getCountFromApi(url: string): Promise<number> {
  const res = await bvgFetch(url, { headers: { Prefer: 'count=exact' } });
  const range = res.headers.get('content-range');
  if (range) {
    const m = range.match(/\/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  if (res.ok) {
    const data = await res.json();
    return Array.isArray(data) ? data.length : 0;
  }
  return 0;
}

export async function fetchExtractionMetrics(): Promise<ExtractionMetrics> {
  try {
    const [feedback, manual, dlq, totalWithDest] = await Promise.all([
      getCountFromApi(`${API_BASE_URL}/extraction_feedback?select=id&limit=1`),
      getCountFromApi(`${API_BASE_URL}/ordenes_intake_lineas?location_status=eq.MANUALLY_SET&select=id&limit=1`),
      getCountFromApi(`${API_BASE_URL}/dlq_orders?select=id&limit=1`),
      getCountFromApi(`${API_BASE_URL}/ordenes_intake_lineas?destination_id=not.is.null&select=id&limit=1`),
    ]);

    const correctionRatePct =
      totalWithDest > 0 ? Math.round((manual / totalWithDest) * 10000) / 100 : null;

    return {
      extractionFeedbackTotal: feedback,
      linesManuallySetTotal: manual,
      dlqOrdersTotal: dlq,
      totalLinesWithDestination: totalWithDest,
      correctionRatePct,
    };
  } catch (error) {
    console.error('Error fetching extraction metrics:', error);
    return {
      extractionFeedbackTotal: 0,
      linesManuallySetTotal: 0,
      dlqOrdersTotal: 0,
      totalLinesWithDestination: 0,
      correctionRatePct: null,
    };
  }
}
