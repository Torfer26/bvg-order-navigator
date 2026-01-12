import type { 
  OrderIntake, 
  OrderLine, 
  OrderEvent, 
  DLQOrder, 
  Client, 
  Remitente, 
  Holiday, 
  LocationAlias,
  DashboardKPIs,
  AuditEntry
} from '@/types';

// Generate deterministic mock data
const clientList: Client[] = [
  { id: 'c1', code: 'METRO', name: 'Metro S.p.A.', email: 'ordini@metro.it', active: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'c2', code: 'ESSELUNGA', name: 'Esselunga', email: 'orders@esselunga.it', active: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'c3', code: 'COOP', name: 'Coop Italia', email: 'forniture@coop.it', active: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'c4', code: 'CARREFOUR', name: 'Carrefour Italia', email: 'ordini@carrefour.it', active: true, createdAt: '2024-02-01T00:00:00Z', updatedAt: '2024-02-01T00:00:00Z' },
  { id: 'c5', code: 'LIDL', name: 'Lidl Italia', email: 'orders@lidl.it', active: false, createdAt: '2024-03-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' },
];

const generateOrders = (): OrderIntake[] => {
  const statuses: OrderIntake['status'][] = ['pending', 'processing', 'completed', 'error'];
  const orders: OrderIntake[] = [];
  
  for (let i = 0; i < 50; i++) {
    const client = clientList[i % clientList.length];
    const daysAgo = Math.floor(Math.random() * 14);
    const receivedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    orders.push({
      id: `ord-${i + 1}`,
      orderCode: `ORD-2024-${String(10000 + i).slice(1)}`,
      messageId: `msg-${Date.now()}-${i}@mail.${client.code.toLowerCase()}.it`,
      clientId: client.id,
      clientName: client.name,
      senderAddress: `ordini@${client.code.toLowerCase()}.it`,
      subject: `Ordine ${i % 3 === 0 ? 'urgente' : ''} #${10000 + i} - Consegna ${new Date(receivedAt.getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT')}`,
      status,
      receivedAt: receivedAt.toISOString(),
      processedAt: status === 'completed' ? new Date(receivedAt.getTime() + 30 * 60 * 1000).toISOString() : undefined,
      linesCount: Math.floor(Math.random() * 20) + 1,
    });
  }
  
  return orders.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
};

const generateOrderLines = (orderId: string, count: number): OrderLine[] => {
  const products = [
    { code: 'LATTE-INT-1L', name: 'Latte Intero 1L', unit: 'PZ' },
    { code: 'YOGURT-BIO-125', name: 'Yogurt Bio 125g', unit: 'PZ' },
    { code: 'BURRO-250', name: 'Burro 250g', unit: 'PZ' },
    { code: 'MOZZ-BUF-125', name: 'Mozzarella Bufala 125g', unit: 'PZ' },
    { code: 'PARM-REG-1KG', name: 'Parmigiano Reggiano 1kg', unit: 'KG' },
    { code: 'RICOTTA-250', name: 'Ricotta 250g', unit: 'PZ' },
    { code: 'GORGONZOLA-DOP', name: 'Gorgonzola DOP', unit: 'KG' },
  ];
  
  return Array.from({ length: count }, (_, i) => {
    const product = products[i % products.length];
    return {
      id: `line-${orderId}-${i + 1}`,
      orderIntakeId: orderId,
      lineNumber: i + 1,
      productCode: product.code,
      productName: product.name,
      quantity: Math.floor(Math.random() * 100) + 1,
      unit: product.unit,
      notes: i % 5 === 0 ? 'Consegna prioritaria' : undefined,
    };
  });
};

const generateDLQOrders = (): DLQOrder[] => {
  const errorCodes = ['PARSE_ERROR', 'VALIDATION_FAILED', 'CLIENT_NOT_FOUND', 'DUPLICATE_ORDER', 'TIMEOUT'];
  const errorMessages = {
    'PARSE_ERROR': 'Impossibile parsare il contenuto dell\'email',
    'VALIDATION_FAILED': 'Campi obbligatori mancanti',
    'CLIENT_NOT_FOUND': 'Cliente non riconosciuto nel sistema',
    'DUPLICATE_ORDER': 'Ordine già presente nel sistema',
    'TIMEOUT': 'Timeout durante l\'elaborazione',
  };
  
  const dlqOrders: DLQOrder[] = [];
  
  for (let i = 0; i < 15; i++) {
    const client = clientList[i % clientList.length];
    const daysAgo = Math.floor(Math.random() * 7);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const errorCode = errorCodes[i % errorCodes.length];
    const resolved = i < 5;
    
    dlqOrders.push({
      id: `dlq-${i + 1}`,
      orderCode: `ORD-2024-${String(20000 + i).slice(1)}`,
      messageId: `dlq-msg-${Date.now()}-${i}@mail.${client.code.toLowerCase()}.it`,
      clientId: client.id,
      clientName: client.name,
      errorCode,
      errorMessage: errorMessages[errorCode as keyof typeof errorMessages],
      retryCount: Math.floor(Math.random() * 3),
      resolved,
      resolvedAt: resolved ? new Date(createdAt.getTime() + 2 * 60 * 60 * 1000).toISOString() : undefined,
      resolvedBy: resolved ? 'ops@bvg.com' : undefined,
      createdAt: createdAt.toISOString(),
    });
  }
  
  return dlqOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

const remitenteList: Remitente[] = clientList.flatMap((client) => [
  { id: `rem-${client.id}-1`, clientId: client.id, email: `ordini@${client.code.toLowerCase()}.it`, name: `${client.name} - Ordini`, active: true, createdAt: '2024-01-01T00:00:00Z' },
  { id: `rem-${client.id}-2`, clientId: client.id, email: `acquisti@${client.code.toLowerCase()}.it`, name: `${client.name} - Acquisti`, active: true, createdAt: '2024-01-01T00:00:00Z' },
]);

const holidayList: Holiday[] = [
  { id: 'h1', date: '2024-01-01', name: 'Capodanno', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'h2', date: '2024-01-06', name: 'Epifania', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'h3', date: '2024-04-01', name: 'Pasquetta', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'h4', date: '2024-04-25', name: 'Festa della Liberazione', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'h5', date: '2024-05-01', name: 'Festa dei Lavoratori', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'h6', date: '2024-06-02', name: 'Festa della Repubblica', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'h7', date: '2024-08-15', name: 'Ferragosto', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'h8', date: '2024-11-01', name: 'Ognissanti', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'h9', date: '2024-12-08', name: 'Immacolata Concezione', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'h10', date: '2024-12-25', name: 'Natale', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'h11', date: '2024-12-26', name: 'Santo Stefano', createdAt: '2024-01-01T00:00:00Z' },
];

const locationAliasList: LocationAlias[] = [
  { id: 'la1', clientId: 'c1', alias: 'METRO MILANO', normalizedLocation: 'Milano - Magazzino Centrale', active: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'la2', clientId: 'c1', alias: 'M. ROMA', normalizedLocation: 'Roma - Deposito Sud', active: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'la3', clientId: 'c2', alias: 'ESS-MI-01', normalizedLocation: 'Milano - Limito', active: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'la4', clientId: 'c3', alias: 'COOP NORD', normalizedLocation: 'Bologna - Hub Logistico', active: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

// Pre-generate mock data
export const mockOrders = generateOrders();
export const mockDLQOrders = generateDLQOrders();
export const mockClients = clientList;
export const mockRemitentes = remitenteList;
export const mockHolidays = holidayList;
export const mockLocationAliases = locationAliasList;

// Generate order lines on demand
export const getOrderLines = (orderId: string): OrderLine[] => {
  const order = mockOrders.find((o) => o.id === orderId);
  if (!order) return [];
  return generateOrderLines(orderId, order.linesCount);
};

// Generate order events on demand
export const getOrderEvents = (orderCode: string): OrderEvent[] => {
  const order = mockOrders.find((o) => o.orderCode === orderCode);
  if (!order) return [];
  
  const events: OrderEvent[] = [
    { id: `ev-${orderCode}-1`, orderCode, eventType: 'received', timestamp: order.receivedAt, details: 'Email ricevuta' },
    { id: `ev-${orderCode}-2`, orderCode, eventType: 'parsed', timestamp: new Date(new Date(order.receivedAt).getTime() + 5000).toISOString(), details: 'Parsing completato' },
  ];
  
  if (order.status === 'completed') {
    events.push(
      { id: `ev-${orderCode}-3`, orderCode, eventType: 'validated', timestamp: new Date(new Date(order.receivedAt).getTime() + 10000).toISOString(), details: 'Validazione completata' },
      { id: `ev-${orderCode}-4`, orderCode, eventType: 'sent', timestamp: order.processedAt!, details: 'Inviato a SAP' }
    );
  } else if (order.status === 'error') {
    events.push(
      { id: `ev-${orderCode}-3`, orderCode, eventType: 'error', timestamp: new Date(new Date(order.receivedAt).getTime() + 10000).toISOString(), details: 'Errore durante la validazione' }
    );
  }
  
  return events;
};

// Dashboard KPIs
export const getDashboardKPIs = (): DashboardKPIs => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const ordersToday = mockOrders.filter((o) => new Date(o.receivedAt) >= today).length;
  const ordersWeek = mockOrders.filter((o) => new Date(o.receivedAt) >= weekAgo).length;
  const errors = mockOrders.filter((o) => o.status === 'error').length;
  const pendingDLQ = mockDLQOrders.filter((o) => !o.resolved).length;
  
  return {
    ordersToday,
    ordersWeek,
    errorRate: ordersWeek > 0 ? (errors / ordersWeek) * 100 : 0,
    pendingDLQ,
    avgProcessingTime: 28.5, // minutes
    successRate: ordersWeek > 0 ? ((ordersWeek - errors) / ordersWeek) * 100 : 100,
  };
};

// Audit entries
export const mockAuditEntries: AuditEntry[] = [
  { id: 'aud-1', actorUserId: '1', actorEmail: 'admin@bvg.com', entityType: 'client', entityId: 'c1', action: 'update', beforeJson: '{"active":false}', afterJson: '{"active":true}', createdAt: '2024-01-10T14:30:00Z' },
  { id: 'aud-2', actorUserId: '2', actorEmail: 'ops@bvg.com', entityType: 'dlq_order', entityId: 'dlq-1', action: 'resolve', afterJson: '{"resolved":true}', createdAt: '2024-01-11T09:15:00Z' },
  { id: 'aud-3', actorUserId: '2', actorEmail: 'ops@bvg.com', entityType: 'order', entityId: 'ord-5', action: 'reprocess', createdAt: '2024-01-11T10:00:00Z' },
];
