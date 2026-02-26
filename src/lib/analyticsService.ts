/**
 * Analytics Service
 * Provides data fetching functions for the Analytics dashboard
 */

import { API_BASE_URL, bvgFetch } from './api';

// ========== TYPES ==========

export interface DateRange {
  from: Date;
  to: Date;
}

export interface AnalyticsQueryFilters {
  clientId?: string;
  regionId?: string;       // región destino (entregas)
  originRegionId?: string; // región origen (carga)
}

export interface AnalyticsKPIs {
  totalOrders: number;
  totalPallets: number;
  totalDeliveries: number;
  uniqueRegions: number;
  uniqueOrigins: number;
  pendingLocations: number;
  linesWithoutOrigin: number;
  avgOrdersPerDay: number;
}

export interface DailyTrend {
  date: string;
  orders: number;
  pallets: number;
  lines: number;
}

export interface ClientStats {
  clientId: string;
  clientName: string;
  totalOrders: number;
  totalPallets: number;
  totalLines: number;
  uniqueDestinations: number;
}

export interface RegionStats {
  region: string;
  deliveries: number;
  pallets: number;
  uniqueDestinations: number;
}

export interface DestinationStats {
  destinationId: number;
  destinationName: string;
  city: string;
  province: string;
  deliveries: number;
  pallets: number;
}

export interface OriginStats {
  originId: number;
  originName: string;
  city: string;
  province: string;
  pickups: number;
  pallets: number;
}

export interface OriginRegionStats {
  region: string;
  pickups: number;
  pallets: number;
  uniqueOrigins: number;
}

export interface OriginDestinationPair {
  originId: number;
  originName: string;
  destinationId: number;
  destinationName: string;
  count: number;
  pallets: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
}

export interface HourlyPattern {
  hour: number;
  orders: number;
}

export interface WeekdayPattern {
  dayOfWeek: number;
  dayName: string;
  orders: number;
}

export interface PeriodComparison {
  current: AnalyticsKPIs;
  previous: AnalyticsKPIs;
  percentChange: {
    orders: number;
    pallets: number;
    deliveries: number;
  };
}

// ========== HELPER FUNCTIONS ==========

function formatDateForQuery(date: Date): string {
  // Use local date to avoid timezone issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayName(dayOfWeek: number): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[dayOfWeek] || '';
}

/** Helper: fetch and filter orders + lines by date range and filters */
async function getFilteredOrdersAndLines(
  dateRange: DateRange,
  filters?: AnalyticsQueryFilters
): Promise<{ orders: any[]; orderIds: Set<string>; lines: any[] }> {
  const fromDate = formatDateForQuery(dateRange.from);
  const toDate = formatDateForQuery(dateRange.to);

  let ordersUrl = `${API_BASE_URL}/ordenes_intake?select=id,created_at,status,client_id&created_at=gte.${fromDate}T00:00:00&created_at=lte.${toDate}T23:59:59`;
  if (filters?.clientId) {
    const clientNum = parseInt(filters.clientId, 10);
    if (!isNaN(clientNum)) ordersUrl += `&client_id=eq.${clientNum}`;
  }
  const ordersRes = await bvgFetch(ordersUrl);
  const orders = ordersRes.ok ? await ordersRes.json() : [];
  let orderIds = new Set(orders.map((o: any) => String(o.id)));

  const linesRes = await bvgFetch(
    `${API_BASE_URL}/ordenes_intake_lineas?or=(anulada.eq.false,anulada.is.null)&select=id,intake_id,pallets,destination_id,origin_id,location_status`
  );
  const allLines = linesRes.ok ? await linesRes.json() : [];
  let lines = allLines.filter((l: any) => orderIds.has(String(l.intake_id)));

  if (filters?.regionId || filters?.originRegionId) {
    const locRes = await bvgFetch(`${API_BASE_URL}/customer_location_stg?select=id,region`);
    const locations = locRes.ok ? await locRes.json() : [];
    const locRegion = new Map(locations.map((l: any) => [String(l.id), l.region]));

    lines = lines.filter((l: any) => {
      if (filters.regionId) {
        if (!l.destination_id) return false;
        if (locRegion.get(String(l.destination_id)) !== filters.regionId) return false;
      }
      if (filters.originRegionId) {
        if (!l.origin_id) return false;
        if (locRegion.get(String(l.origin_id)) !== filters.originRegionId) return false;
      }
      return true;
    });
    orderIds = new Set(lines.map((l: any) => String(l.intake_id)));
  }

  const filteredOrders = orders.filter((o: any) => orderIds.has(String(o.id)));
  return { orders: filteredOrders, orderIds, lines };
}

/** Order summary for day drill-down modal */
export interface OrderForDay {
  id: string;
  orderCode: string;
  clientName: string;
  subject: string;
  status: string;
  receivedAt: string;
  linesCount: number;
}

/**
 * Fetch orders for a single day (for trend chart drill-down modal).
 * Respects same filters as analytics (client, region, originRegion).
 */
export async function fetchOrdersForDay(
  date: string,
  filters?: AnalyticsQueryFilters
): Promise<OrderForDay[]> {
  try {
    const dateObj = new Date(date + 'T12:00:00');
    const dateRange: DateRange = { from: dateObj, to: dateObj };
    const { orders, orderIds } = await getFilteredOrdersAndLines(dateRange, filters);
    if (orders.length === 0) return [];

    const ids = Array.from(orderIds);
    const idsParam = ids.join(',');
    const [fullOrdersRes, clientsRes, lineCountsRes] = await Promise.all([
      bvgFetch(`${API_BASE_URL}/ordenes_intake?id=in.(${idsParam})&select=id,order_code,subject,status,client_id,email_received_at,created_at`),
      bvgFetch(`${API_BASE_URL}/customer_stg?select=id,description&limit=3000`),
      bvgFetch(`${API_BASE_URL}/order_line_counts?intake_id=in.(${idsParam})&select=intake_id,lines_count`),
    ]);

    if (!fullOrdersRes.ok) return [];
    const fullOrders = await fullOrdersRes.json();
    const clients = clientsRes.ok ? await clientsRes.json() : [];
    const clientsMap = new Map<string, string>();
    clients.forEach((c: any) => {
      const desc = c.description || `Cliente ${c.id}`;
      clientsMap.set(String(c.id), desc);
      const num = parseInt(c.id, 10);
      if (!isNaN(num)) clientsMap.set(String(num), desc);
    });
    const lineCounts = lineCountsRes.ok ? await lineCountsRes.json() : [];
    const lineCountsMap = new Map(lineCounts.map((r: any) => [String(r.intake_id), Number(r.lines_count) || 0]));

    return fullOrders.map((row: any) => {
      const hasClient = row.client_id != null;
      const clientName = hasClient
        ? (clientsMap.get(String(row.client_id)) || `Cliente ${row.client_id}`)
        : 'Sin asignar';
      return {
        id: String(row.id),
        orderCode: row.order_code || `ORD-${row.id}`,
        clientName,
        subject: row.subject || 'Sin asunto',
        status: row.status || 'UNKNOWN',
        receivedAt: row.email_received_at ?? row.created_at,
        linesCount: lineCountsMap.get(String(row.id)) || 0,
      };
    });
  } catch (error) {
    console.error('Error fetching orders for day:', error);
    return [];
  }
}

// ========== API FUNCTIONS ==========

/**
 * Fetch main KPIs for the analytics dashboard
 */
export async function fetchAnalyticsKPIs(
  dateRange: DateRange,
  filters?: AnalyticsQueryFilters
): Promise<AnalyticsKPIs> {
  try {
    const { orderIds, lines } = await getFilteredOrdersAndLines(dateRange, filters);

    const totalOrders = orderIds.size;
    const totalPallets = lines.reduce((sum: number, l: any) => sum + (Number(l.pallets) || 0), 0);
    const totalDeliveries = lines.filter((l: any) => l.destination_id).length;
    const uniqueRegions = new Set(lines.filter((l: any) => l.destination_id).map((l: any) => l.destination_id)).size;
    const uniqueOrigins = new Set(lines.filter((l: any) => l.origin_id).map((l: any) => l.origin_id)).size;
    const pendingLocations = lines.filter((l: any) => l.location_status === 'PENDING_LOCATION').length;
    const linesWithoutOrigin = lines.filter((l: any) => !l.origin_id).length;
    
    // Calculate days in range
    const daysDiff = Math.max(1, Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)));
    const avgOrdersPerDay = Math.round((totalOrders / daysDiff) * 10) / 10;
    
    return {
      totalOrders,
      totalPallets: Math.round(totalPallets),
      totalDeliveries,
      uniqueRegions,
      uniqueOrigins,
      pendingLocations,
      linesWithoutOrigin,
      avgOrdersPerDay,
    };
  } catch (error) {
    return {
      totalOrders: 0,
      totalPallets: 0,
      totalDeliveries: 0,
      uniqueRegions: 0,
      uniqueOrigins: 0,
      pendingLocations: 0,
      linesWithoutOrigin: 0,
      avgOrdersPerDay: 0,
    };
  }
}

/**
 * Fetch daily trend data for line chart
 */
export async function fetchDailyTrend(
  dateRange: DateRange,
  filters?: AnalyticsQueryFilters
): Promise<DailyTrend[]> {
  try {
    const { orders, lines } = await getFilteredOrdersAndLines(dateRange, filters);

    const linesByIntake = new Map<string, any[]>();
    lines.forEach((line: any) => {
      const intakeId = String(line.intake_id);
      if (!linesByIntake.has(intakeId)) linesByIntake.set(intakeId, []);
      linesByIntake.get(intakeId)!.push(line);
    });
    
    // Group orders by date
    const dailyMap = new Map<string, { orders: number; pallets: number; lines: number }>();
    
    // Get today's date string for comparison
    const today = new Date();
    const todayStr = formatDateForQuery(today);
    
    // Initialize all dates in range - use string comparison to avoid timezone issues
    const startStr = formatDateForQuery(dateRange.from);
    const endStr = formatDateForQuery(dateRange.to);
    
    // Generate all dates from start to end (inclusive)
    const currentDate = new Date(startStr + 'T12:00:00'); // Use noon to avoid timezone issues
    const maxIterations = 100; // Safety limit
    let iterations = 0;
    
    while (iterations < maxIterations) {
      const dateKey = formatDateForQuery(currentDate);
      dailyMap.set(dateKey, { orders: 0, pallets: 0, lines: 0 });
      
      // Stop if we've reached or passed the end date
      if (dateKey >= endStr) break;
      
      currentDate.setDate(currentDate.getDate() + 1);
      iterations++;
    }
    
    // ALWAYS include today if it's within range or is the end date
    if (todayStr >= startStr && todayStr <= endStr && !dailyMap.has(todayStr)) {
      dailyMap.set(todayStr, { orders: 0, pallets: 0, lines: 0 });
    }
    
    // Aggregate data
    orders.forEach((order: any) => {
      const dateKey = order.created_at.split('T')[0];
      if (dailyMap.has(dateKey)) {
        const dayData = dailyMap.get(dateKey)!;
        dayData.orders += 1;
        
        // Get lines for this order
        const orderLines = linesByIntake.get(String(order.id)) || [];
        dayData.lines += orderLines.length;
        dayData.pallets += orderLines.reduce((sum: number, l: any) => sum + (Number(l.pallets) || 0), 0);
      }
    });
    
    // Convert to array and sort
    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        orders: data.orders,
        pallets: data.pallets,
        lines: data.lines,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Error fetching daily trend:', error);
    return [];
  }
}

/**
 * Fetch status distribution for donut chart
 */
export async function fetchStatusDistribution(
  dateRange: DateRange,
  filters?: AnalyticsQueryFilters
): Promise<StatusDistribution[]> {
  try {
    const { orders } = await getFilteredOrdersAndLines(dateRange, filters);
    
    // Count by status
    const statusMap = new Map<string, number>();
    orders.forEach((order: any) => {
      const status = order.status || 'UNKNOWN';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });
    
    return Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error('Error fetching status distribution:', error);
    return [];
  }
}

/**
 * Fetch client statistics
 */
export async function fetchClientStats(
  dateRange: DateRange,
  filters?: AnalyticsQueryFilters
): Promise<ClientStats[]> {
  try {
    const { orders, lines } = await getFilteredOrdersAndLines(dateRange, filters);

    const clientsResponse = await bvgFetch(`${API_BASE_URL}/customer_stg?select=id,description&limit=3000`);
    const clients = clientsResponse.ok ? await clientsResponse.json() : [];
    const clientMap = new Map<string, string>();
    clients.forEach((c: any) => {
      const clientId = String(c.id);
      if (c.description) clientMap.set(clientId, c.description);
    });

    const linesByIntake = new Map<string, any[]>();
    lines.forEach((line: any) => {
      const key = String(line.intake_id);
      if (!linesByIntake.has(key)) linesByIntake.set(key, []);
      linesByIntake.get(key)!.push(line);
    });
    
    // Aggregate by client
    const clientStats = new Map<string, ClientStats>();
    
    orders.forEach((order: any) => {
      // Convert client_id to padded format (5 digits) to match customer_stg.id
      // e.g. "6" -> "00006", "12" -> "00012"
      const rawClientId = order.client_id;
      const paddedClientId = rawClientId ? String(rawClientId).padStart(5, '0') : 'unknown';
      
      if (!clientStats.has(paddedClientId)) {
        // Get client name from map using the padded ID
        const clientName = clientMap.get(paddedClientId) || `Cliente ${paddedClientId}`;
        
        clientStats.set(paddedClientId, {
          clientId: paddedClientId,
          clientName,
          totalOrders: 0,
          totalPallets: 0,
          totalLines: 0,
          uniqueDestinations: 0,
        });
      }
      
      const stats = clientStats.get(paddedClientId)!;
      stats.totalOrders += 1;
      
      const orderLines = linesByIntake.get(String(order.id)) || [];
      stats.totalLines += orderLines.length;
      stats.totalPallets += orderLines.reduce((sum: number, l: any) => sum + (Number(l.pallets) || 0), 0);
    });
    
    // Calculate unique destinations per client (simplified)
    return Array.from(clientStats.values())
      .map(s => ({ ...s, totalPallets: s.totalPallets }))
      .sort((a, b) => b.totalOrders - a.totalOrders);
  } catch (error) {
    console.error('Error fetching client stats:', error);
    return [];
  }
}

/**
 * Fetch region statistics
 */
export async function fetchRegionStats(
  dateRange: DateRange,
  filters?: AnalyticsQueryFilters
): Promise<RegionStats[]> {
  try {
    const { lines } = await getFilteredOrdersAndLines(dateRange, filters);
    const linesWithDest = lines.filter((l: any) => l.destination_id);
    const locationsResponse = await bvgFetch(`${API_BASE_URL}/customer_location_stg?select=id,region`);
    const locations = locationsResponse.ok ? await locationsResponse.json() : [];
    const locationRegion = new Map(locations.map((l: any) => [String(l.id), l.region]));

    const regionStats = new Map<string, RegionStats>();

    linesWithDest.forEach((line: any) => {
      const region = locationRegion.get(String(line.destination_id)) || 'Sin región';
      
      if (!regionStats.has(region)) {
        regionStats.set(region, {
          region,
          deliveries: 0,
          pallets: 0,
          uniqueDestinations: 0,
        });
      }
      
      const stats = regionStats.get(region)!;
      stats.deliveries += 1;
      stats.pallets += Number(line.pallets) || 0;
    });
    
    return Array.from(regionStats.values())
      .map(s => ({ ...s, pallets: s.pallets }))
      .sort((a, b) => b.deliveries - a.deliveries);
  } catch (error) {
    console.error('Error fetching region stats:', error);
    return [];
  }
}

/**
 * Fetch top destinations
 */
export async function fetchTopDestinations(
  dateRange: DateRange,
  limit: number = 10,
  filters?: AnalyticsQueryFilters
): Promise<DestinationStats[]> {
  try {
    const { lines } = await getFilteredOrdersAndLines(dateRange, filters);
    const linesWithDest = lines.filter((l: any) => l.destination_id);
    
    // Fetch locations
    const locationsResponse = await bvgFetch(`${API_BASE_URL}/customer_location_stg?select=id,description,location,region`);
    const locations = await locationsResponse.json();
    const locationMap = new Map(locations.map((l: any) => [String(l.id), l]));
    const destStats = new Map<string, DestinationStats>();

    linesWithDest.forEach((line: any) => {
      const destId = String(line.destination_id);
      const loc = locationMap.get(destId);
      
      if (!destStats.has(destId)) {
        destStats.set(destId, {
          destinationId: Number(destId),
          destinationName: loc?.description || `Destino ${destId}`,
          city: loc?.location || '',
          province: loc?.region || '',
          deliveries: 0,
          pallets: 0,
        });
      }
      
      const stats = destStats.get(destId)!;
      stats.deliveries += 1;
      stats.pallets += Number(line.pallets) || 0;
    });
    
    return Array.from(destStats.values())
      .map(s => ({ ...s, pallets: s.pallets }))
      .sort((a, b) => b.deliveries - a.deliveries)
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching top destinations:', error);
    return [];
  }
}

/**
 * Fetch top origins (load points)
 */
export async function fetchTopOrigins(
  dateRange: DateRange,
  limit: number = 10,
  filters?: AnalyticsQueryFilters
): Promise<OriginStats[]> {
  try {
    const { lines } = await getFilteredOrdersAndLines(dateRange, filters);
    const linesWithOrigin = lines.filter((l: any) => l.origin_id);

    const locationsResponse = await bvgFetch(`${API_BASE_URL}/customer_location_stg?select=id,description,location,region`);
    const locations = locationsResponse.ok ? await locationsResponse.json() : [];
    const locationMap = new Map(locations.map((l: any) => [String(l.id), l]));
    const originStats = new Map<string, OriginStats>();

    linesWithOrigin.forEach((line: any) => {
      const originId = String(line.origin_id);
      const loc = locationMap.get(originId);

      if (!originStats.has(originId)) {
        originStats.set(originId, {
          originId: Number(originId),
          originName: loc?.description || `Origen ${originId}`,
          city: loc?.location || '',
          province: loc?.region || '',
          pickups: 0,
          pallets: 0,
        });
      }

      const stats = originStats.get(originId)!;
      stats.pickups += 1;
      stats.pallets += Number(line.pallets) || 0;
    });

    return Array.from(originStats.values())
      .map(s => ({ ...s, pallets: s.pallets }))
      .sort((a, b) => b.pickups - a.pickups)
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching top origins:', error);
    return [];
  }
}

/**
 * Fetch origin region statistics
 */
export async function fetchOriginRegionStats(
  dateRange: DateRange,
  filters?: AnalyticsQueryFilters
): Promise<OriginRegionStats[]> {
  try {
    const { lines } = await getFilteredOrdersAndLines(dateRange, filters);
    const linesWithOrigin = lines.filter((l: any) => l.origin_id);

    const locationsResponse = await bvgFetch(`${API_BASE_URL}/customer_location_stg?select=id,region`);
    const locations = locationsResponse.ok ? await locationsResponse.json() : [];
    const locationRegion = new Map(locations.map((l: any) => [String(l.id), l.region]));
    const regionStats = new Map<string, { pickups: number; pallets: number; originIds: Set<string> }>();

    linesWithOrigin.forEach((line: any) => {
      const region = locationRegion.get(String(line.origin_id)) || 'Sin región';

      if (!regionStats.has(region)) {
        regionStats.set(region, {
          pickups: 0,
          pallets: 0,
          originIds: new Set(),
        });
      }

      const stats = regionStats.get(region)!;
      stats.pickups += 1;
      stats.pallets += Number(line.pallets) || 0;
      stats.originIds.add(String(line.origin_id));
    });

    return Array.from(regionStats.entries())
      .map(([region, s]) => ({
        region,
        pickups: s.pickups,
        pallets: s.pallets,
        uniqueOrigins: s.originIds.size,
      }))
      .sort((a, b) => b.pickups - a.pickups);
  } catch (error) {
    console.error('Error fetching origin region stats:', error);
    return [];
  }
}

/**
 * Fetch top origin-destination pairs (flujo logístico)
 */
export async function fetchTopOriginDestinationPairs(
  dateRange: DateRange,
  limit: number = 8,
  filters?: AnalyticsQueryFilters
): Promise<OriginDestinationPair[]> {
  try {
    const { lines } = await getFilteredOrdersAndLines(dateRange, filters);
    const linesWithBoth = lines.filter((l: any) => l.origin_id && l.destination_id);

    const locRes = await bvgFetch(`${API_BASE_URL}/customer_location_stg?select=id,description`);
    const locations = locRes.ok ? await locRes.json() : [];
    const locMap = new Map(locations.map((l: any) => [String(l.id), l.description || '']));

    const pairStats = new Map<string, { count: number; pallets: number }>();

    linesWithBoth.forEach((l: any) => {
      const key = `${l.origin_id}|${l.destination_id}`;
      if (!pairStats.has(key)) pairStats.set(key, { count: 0, pallets: 0 });
      const s = pairStats.get(key)!;
      s.count += 1;
      s.pallets += Number(l.pallets) || 0;
    });

    return Array.from(pairStats.entries())
      .map(([key, s]) => {
        const [oid, did] = key.split('|');
        return {
          originId: Number(oid),
          originName: locMap.get(oid) || `Origen ${oid}`,
          destinationId: Number(did),
          destinationName: locMap.get(did) || `Destino ${did}`,
          count: s.count,
          pallets: s.pallets,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching origin-destination pairs:', error);
    return [];
  }
}

/**
 * Fetch hourly pattern
 */
export async function fetchHourlyPattern(
  dateRange: DateRange,
  filters?: AnalyticsQueryFilters
): Promise<HourlyPattern[]> {
  try {
    const { orders } = await getFilteredOrdersAndLines(dateRange, filters);
    
    // Count by hour
    const hourMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) hourMap.set(i, 0);
    
    orders.forEach((order: any) => {
      const hour = new Date(order.created_at).getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });
    
    return Array.from(hourMap.entries())
      .map(([hour, orders]) => ({ hour, orders }))
      .sort((a, b) => a.hour - b.hour);
  } catch (error) {
    console.error('Error fetching hourly pattern:', error);
    return [];
  }
}

/**
 * Fetch weekday pattern
 */
export async function fetchWeekdayPattern(
  dateRange: DateRange,
  filters?: AnalyticsQueryFilters
): Promise<WeekdayPattern[]> {
  try {
    const { orders } = await getFilteredOrdersAndLines(dateRange, filters);
    
    // Count by day of week
    const dayMap = new Map<number, number>();
    for (let i = 0; i < 7; i++) dayMap.set(i, 0);
    
    orders.forEach((order: any) => {
      const dow = new Date(order.created_at).getDay();
      dayMap.set(dow, (dayMap.get(dow) || 0) + 1);
    });
    
    return Array.from(dayMap.entries())
      .map(([dayOfWeek, orders]) => ({
        dayOfWeek,
        dayName: getDayName(dayOfWeek),
        orders,
      }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  } catch (error) {
    console.error('Error fetching weekday pattern:', error);
    return [];
  }
}

/**
 * Fetch period comparison (current vs previous)
 */
export async function fetchPeriodComparison(
  dateRange: DateRange,
  filters?: AnalyticsQueryFilters
): Promise<PeriodComparison> {
  const durationMs = dateRange.to.getTime() - dateRange.from.getTime();
  const previousFrom = new Date(dateRange.from.getTime() - durationMs);
  const previousTo = new Date(dateRange.from.getTime() - 1);

  const [current, previous] = await Promise.all([
    fetchAnalyticsKPIs(dateRange, filters),
    fetchAnalyticsKPIs({ from: previousFrom, to: previousTo }, filters),
  ]);
  
  const calcChange = (curr: number, prev: number): number => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };
  
  return {
    current,
    previous,
    percentChange: {
      orders: calcChange(current.totalOrders, previous.totalOrders),
      pallets: calcChange(current.totalPallets, previous.totalPallets),
      deliveries: calcChange(current.totalDeliveries, previous.totalDeliveries),
    },
  };
}

// ========== NEW: PENDING LOCATION FUNCTIONS ==========

export interface PendingLocationLine {
  lineId: string;
  orderId: string;
  orderCode: string;
  clientId: string;
  clientName: string;
  rawDestinationText: string;
  rawCustomerText?: string;
  pallets: number;
  deliveryDate?: string;
  createdAt: string;
  suggestionsCount?: number;
}

/**
 * Fetch lines pending location assignment for the analytics queue
 */
export async function fetchPendingLocationLinesForAnalytics(limit: number = 20): Promise<PendingLocationLine[]> {
  try {
    // Fetch lines and filter in JS (more reliable if column doesn't exist or has different values)
    const linesResponse = await bvgFetch(
      `${API_BASE_URL}/ordenes_intake_lineas?select=id,intake_id,customer_name,raw_destination_text,raw_customer_text,pallets,delivery_date,location_status,location_suggestions&order=id.desc&limit=200`
    );
    
    if (!linesResponse.ok) {
      console.warn('Failed to fetch lines for pending locations:', linesResponse.status);
      return [];
    }
    
    const allLines = await linesResponse.json();
    // Filter for PENDING_LOCATION in JS
    const lines = allLines
      .filter((l: any) => l.location_status === 'PENDING_LOCATION' || (!l.location_status && !l.destination_id))
      .slice(0, limit);
    
    if (lines.length === 0) return [];
    
    // Get unique intake IDs to fetch order info
    const intakeIds = [...new Set(lines.map((l: any) => l.intake_id))];
    
    // Fetch orders info
    const ordersResponse = await bvgFetch(
      `${API_BASE_URL}/ordenes_intake?id=in.(${intakeIds.join(',')})&select=id,order_code,client_id,created_at`
    );
    const orders = ordersResponse.ok ? await ordersResponse.json() : [];
    const ordersMap = new Map(orders.map((o: any) => [String(o.id), o]));
    
    // Fetch clients map
    const clientIds = [...new Set(orders.map((o: any) => o.client_id).filter(Boolean))];
    let clientsMap: Map<string, string> = new Map();
    
    if (clientIds.length > 0) {
      const clientsResponse = await bvgFetch(
        `${API_BASE_URL}/customer_stg?select=id,description&limit=3000`
      );
      if (clientsResponse.ok) {
        const clients = await clientsResponse.json();
        clients.forEach((c: any) => {
          clientsMap.set(c.id, c.description || `Cliente ${c.id}`);
          // Also map numeric IDs
          const numericId = parseInt(c.id, 10);
          if (!isNaN(numericId)) {
            clientsMap.set(String(numericId), c.description || `Cliente ${c.id}`);
          }
        });
      }
    }
    
    // Map to PendingLocationLine
    return lines.map((line: any) => {
      const order = ordersMap.get(String(line.intake_id)) || {};
      const clientId = order.client_id ? String(order.client_id).padStart(5, '0') : '';
      const clientName = clientsMap.get(clientId) || clientsMap.get(order.client_id) || `Cliente ${order.client_id || 'Desconocido'}`;
      
      return {
        lineId: String(line.id),
        orderId: String(line.intake_id),
        orderCode: order.order_code || `ORD-${line.intake_id}`,
        clientId: order.client_id || '',
        clientName,
        rawDestinationText: line.raw_destination_text || line.customer_name || 'Sin especificar',
        rawCustomerText: line.raw_customer_text,
        pallets: Number(line.pallets) || 0,
        deliveryDate: line.delivery_date,
        createdAt: order.created_at || new Date().toISOString(),
        suggestionsCount: Array.isArray(line.location_suggestions) ? line.location_suggestions.length : 0,
      };
    });
  } catch (error) {
    console.error('Error fetching pending location lines:', error);
    return [];
  }
}

// ========== NEW: BACKLOG AND AGING METRICS ==========

export interface BacklogMetrics {
  totalBacklog: number;
  byCategory: {
    pendingLocation: number;
    pendingValidation: number;
    pendingReview: number;
    inProcessing: number;
  };
  agingDistribution: {
    under24h: number;
    between24and48h: number;
    over48h: number;
  };
}

/**
 * Fetch backlog and aging metrics
 */
export async function fetchBacklogMetrics(): Promise<BacklogMetrics> {
  try {
    // Fetch all orders and filter in JS (more reliable than complex PostgREST filters)
    const ordersResponse = await bvgFetch(
      `${API_BASE_URL}/ordenes_intake?select=id,status,created_at&limit=500`
    );
    
    if (!ordersResponse.ok) {
      console.error('Failed to fetch orders for backlog:', ordersResponse.status);
      throw new Error('Failed to fetch orders for backlog');
    }
    
    const allOrders = await ordersResponse.json();
    // Filter non-completed orders in JS
    const orders = allOrders.filter((o: any) => 
      o.status !== 'COMPLETED' && o.status !== 'REJECTED'
    );
    
    // Fetch lines for pending location count - handle missing column gracefully
    let pendingLines: any[] = [];
    try {
      const linesResponse = await bvgFetch(
        `${API_BASE_URL}/ordenes_intake_lineas?select=id,location_status&limit=1000`
      );
      if (linesResponse.ok) {
        const allLines = await linesResponse.json();
        pendingLines = allLines.filter((l: any) => l.location_status === 'PENDING_LOCATION');
      }
    } catch (e) {
      console.warn('Could not fetch pending location lines:', e);
    }
    
    const now = new Date();
    const h24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const h48Ago = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    
    // Calculate categories
    const byStatus = orders.reduce((acc: Record<string, number>, order: any) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate aging
    let under24h = 0;
    let between24and48h = 0;
    let over48h = 0;
    
    orders.forEach((order: any) => {
      const createdAt = new Date(order.created_at);
      if (createdAt >= h24Ago) {
        under24h++;
      } else if (createdAt >= h48Ago) {
        between24and48h++;
      } else {
        over48h++;
      }
    });
    
    return {
      totalBacklog: orders.length,
      byCategory: {
        pendingLocation: pendingLines.length,
        pendingValidation: (byStatus['VALIDATING'] || 0) + (byStatus['PARSING'] || 0),
        pendingReview: (byStatus['IN_REVIEW'] || 0) + (byStatus['AWAITING_INFO'] || 0),
        inProcessing: byStatus['PROCESSING'] || 0,
      },
      agingDistribution: {
        under24h,
        between24and48h,
        over48h,
      },
    };
  } catch (error) {
    console.error('Error fetching backlog metrics:', error);
    return {
      totalBacklog: 0,
      byCategory: {
        pendingLocation: 0,
        pendingValidation: 0,
        pendingReview: 0,
        inProcessing: 0,
      },
      agingDistribution: {
        under24h: 0,
        between24and48h: 0,
        over48h: 0,
      },
    };
  }
}

// ========== NEW: FETCH UNIQUE CLIENTS AND REGIONS FOR FILTERS ==========

export interface FilterOption {
  id: string;
  name: string;
}

/**
 * Fetch unique clients for filter dropdown
 */
export async function fetchClientsForFilter(): Promise<FilterOption[]> {
  try {
    // Simple query without complex filters that might fail
    const response = await bvgFetch(
      `${API_BASE_URL}/customer_stg?select=id,description&limit=100`
    );
    
    if (!response.ok) {
      console.warn('Failed to fetch clients for filter:', response.status);
      return [];
    }
    
    const clients = await response.json();
    return clients
      .filter((c: any) => c.description) // Only clients with names
      .map((c: any) => ({
        id: c.id,
        name: c.description || `Cliente ${c.id}`,
      }))
      .sort((a: FilterOption, b: FilterOption) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching clients for filter:', error);
    return [];
  }
}

/**
 * Fetch unique regions for filter dropdown
 */
export async function fetchRegionsForFilter(): Promise<FilterOption[]> {
  try {
    // Simple query - filter nulls in JS
    const response = await bvgFetch(
      `${API_BASE_URL}/customer_location_stg?select=region&limit=500`
    );
    
    if (!response.ok) {
      console.warn('Failed to fetch regions for filter:', response.status);
      return [];
    }
    
    const locations = await response.json();
    const uniqueRegions = [...new Set(locations.map((l: any) => l.region).filter(Boolean))];
    
    return uniqueRegions.sort().map((region) => ({
      id: region as string,
      name: region as string,
    }));
  } catch (error) {
    console.error('Error fetching regions for filter:', error);
    return [];
  }
}
