export type Language = 'es' | 'it';

export interface Translations {
  // Common
  common: {
    search: string;
    filter: string;
    clearFilters: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    actions: string;
    status: string;
    active: string;
    inactive: string;
    all: string;
    loading: string;
    noData: string;
    confirm: string;
    from: string;
    to: string;
    date: string;
    client: string;
    email: string;
    name: string;
    code: string;
    created: string;
    updated: string;
    page: string;
    of: string;
    showing: string;
  };
  
  // Auth
  auth: {
    login: string;
    logout: string;
    email: string;
    password: string;
    loginButton: string;
    loggingIn: string;
    invalidCredentials: string;
    loginError: string;
    loginTitle: string;
    loginSubtitle: string;
    demoCredentials: string;
  };
  
  // Navigation
  nav: {
    dashboard: string;
    orders: string;
    dlq: string;
    clients: string;
    remitentes: string;
    holidays: string;
    locationAliases: string;
    users: string;
    collapse: string;
  };
  
  // Roles
  roles: {
    admin: string;
    ops: string;
    read: string;
  };
  
  // Dashboard
  dashboard: {
    title: string;
    subtitle: string;
    ordersToday: string;
    ordersWeek: string;
    successRate: string;
    avgTime: string;
    pendingDLQ: string;
    toResolve: string;
    recentOrders: string;
    viewAll: string;
    dlqToResolve: string;
    noPendingIssues: string;
    allOrdersProcessed: string;
    quickStats: string;
    pendingOrders: string;
    processing: string;
    errorRate7d: string;
    lines: string;
    attempts: string;
    last7days: string;
    orderProcessing: string;
  };
  
  // Orders
  orders: {
    title: string;
    subtitle: string;
    orderCode: string;
    subject: string;
    linesCount: string;
    receivedAt: string;
    searchPlaceholder: string;
    noOrdersFound: string;
    orderDetail: string;
    messageId: string;
    emailSummary: string;
    noSummary: string;
    technicalDetails: string;
    sender: string;
    received: string;
    processed: string;
    timeline: string;
    orderLines: string;
    reprocess: string;
    reprocessing: string;
    reprocessSent: string;
    orderNotFound: string;
    backToOrders: string;
    productCode: string;
    product: string;
    quantity: string;
    unit: string;
    notes: string;
    // Columnas de líneas de pedido
    consignee: string;        // Antes "cliente" - es el punto de entrega
    locality: string;         // Antes "destino" - es la localidad/ciudad
    deliveryAddress: string;  // Nueva columna para dirección de entrega
    pallets: string;
    palletsShort: string;
    deliveryDate: string;
    lineNotes: string;
    pending: string;
    manual: string;
    // Nuevos campos para direcciones de entrega
    assignAddress: string;
    manuallyAssigned: string;
    editDeliveryAddress: string;
    pendingDeliveryAddressSingular: string;
    pendingDeliveryAddressPlural: string;
    lineWithoutDeliveryAddressSingular: string;
    lineWithoutDeliveryAddressPlural: string;
    assignDeliveryAddressHelp: string;
    noEventsRecorded: string;
  };
  
  // Order statuses (matching bvg.order_intake_status ENUM)
  orderStatus: {
    RECEIVED: string;
    PARSING: string;
    VALIDATING: string;
    AWAITING_INFO: string;
    IN_REVIEW: string;
    APPROVED: string;
    PROCESSING: string;
    COMPLETED: string;
    REJECTED: string;
    ERROR: string;
  };
  
  // Order events
  orderEvents: {
    received: string;
    parsed: string;
    validated: string;
    sent: string;
    error: string;
    reprocessed: string;
  };
  
  // DLQ
  dlq: {
    title: string;
    subtitle: string;
    errorCode: string;
    errorMessage: string;
    retryCount: string;
    resolved: string;
    unresolved: string;
    resolve: string;
    retry: string;
    resolvedBy: string;
    confirmResolve: string;
    confirmRetry: string;
    resolveMessage: string;
    retryMessage: string;
    markedResolved: string;
    retryStarted: string;
    noDLQOrders: string;
    searchPlaceholder: string;
    errorType: string;
  };
  
  // Masters - Clients
  clients: {
    title: string;
    subtitle: string;
    newClient: string;
    editClient: string;
    clientCreated: string;
    clientUpdated: string;
    clientDeleted: string;
    noClientsFound: string;
    searchPlaceholder: string;
    lastUpdate: string;
  };
  
  // Masters - Remitentes
  remitentes: {
    title: string;
    subtitle: string;
    newRemitente: string;
    editRemitente: string;
    remitenteCreated: string;
    remitenteUpdated: string;
    selectClient: string;
    noRemitentesFound: string;
    searchPlaceholder: string;
    office: string;
  };
  
  // Masters - Holidays
  holidays: {
    title: string;
    subtitle: string;
    newHoliday: string;
    editHoliday: string;
    holidayCreated: string;
    holidayUpdated: string;
    holidayDeleted: string;
    noHolidaysFound: string;
    region: string;
    national: string;
    selectDate: string;
    regionOptional: string;
  };
  
  // Masters - Location Aliases
  aliases: {
    title: string;
    subtitle: string;
    newAlias: string;
    editAlias: string;
    aliasCreated: string;
    aliasUpdated: string;
    noAliasesFound: string;
    searchPlaceholder: string;
    alias: string;
    mapping: string;
    normalizedLocation: string;
    aliasHint: string;
  };
  
  // Users
  users: {
    title: string;
    subtitle: string;
    newUser: string;
    editUser: string;
    userCreated: string;
    userUpdated: string;
    userDeleted: string;
    noUsersFound: string;
    lastLogin: string;
    never: string;
    role: string;
    passwordHint: string;
    fullAccess: string;
    viewAndActions: string;
    viewOnly: string;
  };
  
  // Header
  header: {
    consoleTitle: string;
    notifications: string;
  };
  
  // Branding
  branding: {
    tagline: string;
    description: string;
    copyright: string;
  };
}

export const translations: Record<Language, Translations> = {
  es: {
    common: {
      search: 'Buscar',
      filter: 'Filtrar',
      clearFilters: 'Limpiar filtros',
      save: 'Guardar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      create: 'Crear',
      actions: 'Acciones',
      status: 'Estado',
      active: 'Activo',
      inactive: 'Inactivo',
      all: 'Todos',
      loading: 'Cargando...',
      noData: 'Sin datos disponibles',
      confirm: 'Confirmar',
      from: 'Desde',
      to: 'Hasta',
      date: 'Fecha',
      client: 'Cliente',
      email: 'Email',
      name: 'Nombre',
      code: 'Código',
      created: 'Creado',
      updated: 'Actualizado',
      page: 'Página',
      of: 'de',
      showing: 'Mostrando',
    },
    auth: {
      login: 'Iniciar sesión',
      logout: 'Cerrar sesión',
      email: 'Email',
      password: 'Contraseña',
      loginButton: 'Acceder',
      loggingIn: 'Accediendo...',
      invalidCredentials: 'Credenciales inválidas. Inténtalo de nuevo.',
      loginError: 'Se ha producido un error. Inténtalo más tarde.',
      loginTitle: 'Acceder',
      loginSubtitle: 'Introduce tus credenciales para acceder a la consola',
      demoCredentials: 'Credenciales demo:',
    },
    nav: {
      dashboard: 'Panel',
      orders: 'Pedidos Intake',
      dlq: 'DLQ',
      clients: 'Clientes',
      remitentes: 'Remitentes',
      holidays: 'Festivos',
      locationAliases: 'Alias Ubicación',
      users: 'Usuarios',
      collapse: 'Comprimir',
    },
    roles: {
      admin: 'Administrador',
      ops: 'Operador',
      read: 'Visualizador',
    },
    dashboard: {
      title: 'Panel de Control',
      subtitle: 'Resumen de las operaciones de hoy',
      ordersToday: 'Pedidos Hoy',
      ordersWeek: 'últimos 7 días',
      successRate: 'Tasa de Éxito',
      avgTime: 'Tiempo Medio',
      pendingDLQ: 'DLQ Pendientes',
      toResolve: 'Por resolver',
      recentOrders: 'Pedidos Recientes',
      viewAll: 'Ver todos',
      dlqToResolve: 'DLQ por Resolver',
      noPendingIssues: 'Sin problemas pendientes',
      allOrdersProcessed: 'Todos los pedidos se han procesado correctamente',
      quickStats: 'Estadísticas Rápidas',
      pendingOrders: 'Pedidos en espera',
      processing: 'En procesamiento',
      errorRate7d: 'Tasa errores (7d)',
      lines: 'líneas',
      attempts: 'intentos',
      last7days: 'últimos 7 días',
      orderProcessing: 'Procesamiento pedido',
    },
    orders: {
      title: 'Pedidos Intake',
      subtitle: 'Visualiza y gestiona los pedidos recibidos por email',
      orderCode: 'Código Pedido',
      subject: 'Asunto',
      linesCount: 'Líneas',
      receivedAt: 'Recibido',
      searchPlaceholder: 'Buscar por código, cliente, asunto...',
      noOrdersFound: 'No se encontraron pedidos con los filtros seleccionados',
      orderDetail: 'Detalle del Pedido',
      messageId: 'ID Mensaje',
      emailSummary: 'Resumen del email',
      noSummary: 'Sin resumen',
      technicalDetails: 'Detalles técnicos',
      sender: 'Remitente',
      received: 'Recibido',
      processed: 'Procesado',
      timeline: 'Cronología',
      orderLines: 'Líneas del Pedido',
      reprocess: 'Reprocesar',
      reprocessing: 'Reprocesando...',
      reprocessSent: 'Pedido enviado para reprocesar',
      orderNotFound: 'Pedido no encontrado',
      backToOrders: 'Volver a pedidos',
      productCode: 'Código',
      product: 'Producto',
      quantity: 'Cantidad',
      unit: 'UM',
      notes: 'Notas',
      // Columnas de líneas de pedido
      consignee: 'Consignatario',
      locality: 'Localidad',
      deliveryAddress: 'Dirección de Entrega',
      pallets: 'Palets',
      palletsShort: 'pal',
      deliveryDate: 'Fecha Entrega',
      lineNotes: 'Nota',
      pending: 'Pendiente',
      manual: 'Manual',
      // Nuevos campos para direcciones de entrega
      assignAddress: 'Asignar dirección',
      manuallyAssigned: 'Asignada',
      editDeliveryAddress: 'Editar dirección de entrega',
      pendingDeliveryAddressSingular: 'dirección de entrega pendiente',
      pendingDeliveryAddressPlural: 'direcciones de entrega pendientes',
      lineWithoutDeliveryAddressSingular: 'línea sin dirección de entrega asignada',
      lineWithoutDeliveryAddressPlural: 'líneas sin dirección de entrega asignada',
      assignDeliveryAddressHelp: 'Haz clic en "Asignar dirección" para buscar y vincular la dirección de entrega del consignatario en nuestra base de datos.',
      noEventsRecorded: 'No hay eventos registrados para este pedido.',
    },
    orderStatus: {
      RECEIVED: 'Recibido',
      PARSING: 'Analizando',
      VALIDATING: 'Validando',
      AWAITING_INFO: 'Esperando info',
      IN_REVIEW: 'En revisión',
      APPROVED: 'Aprobado',
      PROCESSING: 'Procesando',
      COMPLETED: 'Completado',
      REJECTED: 'Rechazado',
      ERROR: 'Error',
    },
    orderEvents: {
      received: 'Email recibido',
      parsed: 'Parsing completado',
      validated: 'Validación completada',
      sent: 'Enviado a SAP',
      error: 'Error durante validación',
      reprocessed: 'Reprocesado',
    },
    dlq: {
      title: 'Dead Letter Queue',
      subtitle: 'Gestiona los pedidos que no se han procesado correctamente',
      errorCode: 'Código Error',
      errorMessage: 'Mensaje',
      retryCount: 'Intentos',
      resolved: 'Resuelto',
      unresolved: 'Por resolver',
      resolve: 'Resolver',
      retry: 'Reintentar',
      resolvedBy: 'Resuelto por',
      confirmResolve: 'Confirmar Resolución',
      confirmRetry: 'Confirmar Reintento',
      resolveMessage: '¿Estás seguro de marcar el pedido {orderCode} como resuelto?',
      retryMessage: '¿Estás seguro de reenviar el pedido {orderCode} para reprocesar?',
      markedResolved: 'Pedido {orderCode} marcado como resuelto',
      retryStarted: 'Reenvío del pedido {orderCode} iniciado',
      noDLQOrders: 'No hay pedidos en la DLQ',
      searchPlaceholder: 'Buscar por código, cliente, error...',
      errorType: 'Tipo error',
    },
    clients: {
      title: 'Clientes',
      subtitle: 'Gestiona el maestro de clientes',
      newClient: 'Nuevo Cliente',
      editClient: 'Editar Cliente',
      clientCreated: 'Cliente {name} creado',
      clientUpdated: 'Cliente {name} actualizado',
      clientDeleted: 'Cliente {name} eliminado',
      noClientsFound: 'No se encontraron clientes',
      searchPlaceholder: 'Buscar por código, nombre, email...',
      lastUpdate: 'Última Actualización',
    },
    remitentes: {
      title: 'Remitentes',
      subtitle: 'Gestiona las direcciones de email autorizadas',
      newRemitente: 'Nuevo Remitente',
      editRemitente: 'Editar Remitente',
      remitenteCreated: 'Remitente creado',
      remitenteUpdated: 'Remitente actualizado',
      selectClient: 'Seleccionar cliente',
      noRemitentesFound: 'No se encontraron remitentes',
      searchPlaceholder: 'Buscar por email, nombre...',
      office: 'ej. Oficina de Pedidos',
    },
    holidays: {
      title: 'Festivos',
      subtitle: 'Gestiona el calendario de festivos',
      newHoliday: 'Nuevo Festivo',
      editHoliday: 'Editar Festivo',
      holidayCreated: 'Festivo creado',
      holidayUpdated: 'Festivo actualizado',
      holidayDeleted: 'Festivo "{name}" eliminado',
      noHolidaysFound: 'No hay festivos configurados',
      region: 'Región',
      national: 'Nacional',
      selectDate: 'Seleccionar fecha',
      regionOptional: 'ej. Cataluña (dejar vacío para nacional)',
    },
    aliases: {
      title: 'Alias de Ubicación',
      subtitle: 'Gestiona los mapeos de alias de ubicaciones',
      newAlias: 'Nuevo Alias',
      editAlias: 'Editar Alias',
      aliasCreated: 'Alias creado',
      aliasUpdated: 'Alias actualizado',
      noAliasesFound: 'No se encontraron alias',
      searchPlaceholder: 'Buscar por alias o ubicación...',
      alias: 'Alias',
      mapping: 'Mapeo',
      normalizedLocation: 'Ubicación Normalizada',
      aliasHint: 'ej. METRO MADRID',
    },
    users: {
      title: 'Usuarios',
      subtitle: 'Gestiona los usuarios y sus permisos',
      newUser: 'Nuevo Usuario',
      editUser: 'Editar Usuario',
      userCreated: 'Usuario creado',
      userUpdated: 'Usuario actualizado',
      userDeleted: 'Usuario {name} eliminado',
      noUsersFound: 'No se encontraron usuarios',
      lastLogin: 'Último Acceso',
      never: 'Nunca',
      role: 'Rol',
      passwordHint: '(dejar vacío para no cambiar)',
      fullAccess: 'Acceso completo + gestión usuarios',
      viewAndActions: 'Visualizar + acciones operativas',
      viewOnly: 'Solo visualización',
    },
    header: {
      consoleTitle: 'Brivio & Viganò Operations Console',
      notifications: 'Notificaciones',
    },
    branding: {
      tagline: 'Gestión de Pedidos\nAutomatizada',
      description: 'Consola operativa para el monitoreo y gestión de pedidos de Brivio & Viganò.',
      copyright: '© 2024 Brivio & Viganò. Todos los derechos reservados.',
    },
  },
  it: {
    common: {
      search: 'Cerca',
      filter: 'Filtra',
      clearFilters: 'Pulisci filtri',
      save: 'Salva',
      cancel: 'Annulla',
      delete: 'Elimina',
      edit: 'Modifica',
      create: 'Crea',
      actions: 'Azioni',
      status: 'Stato',
      active: 'Attivo',
      inactive: 'Inattivo',
      all: 'Tutti',
      loading: 'Caricamento...',
      noData: 'Nessun dato disponibile',
      confirm: 'Conferma',
      from: 'Da',
      to: 'A',
      date: 'Data',
      client: 'Cliente',
      email: 'Email',
      name: 'Nome',
      code: 'Codice',
      created: 'Creato',
      updated: 'Aggiornato',
      page: 'Pagina',
      of: 'di',
      showing: 'Mostrando',
    },
    auth: {
      login: 'Accedi',
      logout: 'Esci',
      email: 'Email',
      password: 'Password',
      loginButton: 'Accedi',
      loggingIn: 'Accesso in corso...',
      invalidCredentials: 'Credenziali non valide. Riprova.',
      loginError: 'Si è verificato un errore. Riprova più tardi.',
      loginTitle: 'Accedi',
      loginSubtitle: 'Inserisci le tue credenziali per accedere alla console',
      demoCredentials: 'Credenziali demo:',
    },
    nav: {
      dashboard: 'Dashboard',
      orders: 'Ordini Intake',
      dlq: 'DLQ',
      clients: 'Clienti',
      remitentes: 'Remitentes',
      holidays: 'Festività',
      locationAliases: 'Alias Località',
      users: 'Utenti',
      collapse: 'Comprimi',
    },
    roles: {
      admin: 'Amministratore',
      ops: 'Operatore',
      read: 'Visualizzatore',
    },
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Panoramica delle operazioni di oggi',
      ordersToday: 'Ordini Oggi',
      ordersWeek: 'ultimi 7 giorni',
      successRate: 'Tasso Successo',
      avgTime: 'Tempo Medio',
      pendingDLQ: 'DLQ Pendenti',
      toResolve: 'Da risolvere',
      recentOrders: 'Ordini Recenti',
      viewAll: 'Vedi tutti',
      dlqToResolve: 'DLQ da Risolvere',
      noPendingIssues: 'Nessun problema pendente',
      allOrdersProcessed: 'Tutti gli ordini sono stati elaborati correttamente',
      quickStats: 'Statistiche Rapide',
      pendingOrders: 'Ordini in attesa',
      processing: 'In elaborazione',
      errorRate7d: 'Tasso errori (7gg)',
      lines: 'righe',
      attempts: 'tentativi',
      last7days: 'ultimi 7 giorni',
      orderProcessing: 'Elaborazione ordine',
    },
    orders: {
      title: 'Ordini Intake',
      subtitle: 'Visualizza e gestisci gli ordini ricevuti via email',
      orderCode: 'Codice Ordine',
      subject: 'Oggetto',
      linesCount: 'Righe',
      receivedAt: 'Ricevuto',
      searchPlaceholder: 'Cerca per codice, cliente, oggetto...',
      noOrdersFound: 'Nessun ordine trovato con i filtri selezionati',
      orderDetail: 'Dettagli Ordine',
      messageId: 'Message ID',
      emailSummary: 'Riepilogo email',
      noSummary: 'Nessun riepilogo',
      technicalDetails: 'Dettagli tecnici',
      sender: 'Mittente',
      received: 'Ricevuto',
      processed: 'Elaborato',
      timeline: 'Timeline',
      orderLines: 'Righe Ordine',
      reprocess: 'Rielabora',
      reprocessing: 'Rielaborazione...',
      reprocessSent: 'Ordine inviato per rielaborazione',
      orderNotFound: 'Ordine non trovato',
      backToOrders: 'Torna agli ordini',
      productCode: 'Codice',
      product: 'Prodotto',
      quantity: 'Quantità',
      unit: 'UM',
      // Columnas de líneas de pedido
      consignee: 'Consegnatario',
      locality: 'Località',
      deliveryAddress: 'Indirizzo di Consegna',
      pallets: 'Pallet',
      palletsShort: 'pal',
      deliveryDate: 'Data Consegna',
      lineNotes: 'Note',
      pending: 'In attesa',
      manual: 'Manuale',
      notes: 'Note',
      // Nuovi campi per indirizzi di consegna
      assignAddress: 'Assegna indirizzo',
      manuallyAssigned: 'Assegnato',
      editDeliveryAddress: 'Modifica indirizzo di consegna',
      pendingDeliveryAddressSingular: 'indirizzo di consegna in attesa',
      pendingDeliveryAddressPlural: 'indirizzi di consegna in attesa',
      lineWithoutDeliveryAddressSingular: 'riga senza indirizzo di consegna assegnato',
      lineWithoutDeliveryAddressPlural: 'righe senza indirizzo di consegna assegnato',
      assignDeliveryAddressHelp: 'Clicca su "Assegna indirizzo" per cercare e collegare l\'indirizzo di consegna del consegnatario nel nostro database.',
      noEventsRecorded: 'Nessun evento registrato per questo ordine.',
    },
    orderStatus: {
      RECEIVED: 'Ricevuto',
      PARSING: 'Analizzando',
      VALIDATING: 'Validando',
      AWAITING_INFO: 'In attesa info',
      IN_REVIEW: 'In revisione',
      APPROVED: 'Approvato',
      PROCESSING: 'In elaborazione',
      COMPLETED: 'Completato',
      REJECTED: 'Rifiutato',
      ERROR: 'Errore',
    },
    orderEvents: {
      received: 'Email ricevuta',
      parsed: 'Parsing completato',
      validated: 'Validazione completata',
      sent: 'Inviato a SAP',
      error: 'Errore durante la validazione',
      reprocessed: 'Rielaborato',
    },
    dlq: {
      title: 'Dead Letter Queue',
      subtitle: 'Gestisci gli ordini che non sono stati elaborati correttamente',
      errorCode: 'Codice Errore',
      errorMessage: 'Messaggio',
      retryCount: 'Tentativi',
      resolved: 'Risolto',
      unresolved: 'Da risolvere',
      resolve: 'Risolvi',
      retry: 'Riprova',
      resolvedBy: 'Risolto da',
      confirmResolve: 'Conferma Risoluzione',
      confirmRetry: 'Conferma Reinvio',
      resolveMessage: "Sei sicuro di voler marcare l'ordine {orderCode} come risolto?",
      retryMessage: "Sei sicuro di voler reinviare l'ordine {orderCode} per rielaborazione?",
      markedResolved: 'Ordine {orderCode} marcato come risolto',
      retryStarted: 'Reinvio ordine {orderCode} avviato',
      noDLQOrders: 'Nessun ordine nella DLQ',
      searchPlaceholder: 'Cerca per codice, cliente, errore...',
      errorType: 'Tipo errore',
    },
    clients: {
      title: 'Clienti',
      subtitle: "Gestisci l'anagrafica clienti",
      newClient: 'Nuovo Cliente',
      editClient: 'Modifica Cliente',
      clientCreated: 'Cliente {name} creato',
      clientUpdated: 'Cliente {name} aggiornato',
      clientDeleted: 'Cliente {name} eliminato',
      noClientsFound: 'Nessun cliente trovato',
      searchPlaceholder: 'Cerca per codice, nome, email...',
      lastUpdate: 'Ultimo Aggiornamento',
    },
    remitentes: {
      title: 'Remitentes',
      subtitle: 'Gestisci gli indirizzi email mittenti autorizzati',
      newRemitente: 'Nuovo Remitente',
      editRemitente: 'Modifica Remitente',
      remitenteCreated: 'Remitente creato',
      remitenteUpdated: 'Remitente aggiornato',
      selectClient: 'Seleziona cliente',
      noRemitentesFound: 'Nessun remitente trovato',
      searchPlaceholder: 'Cerca per email, nome...',
      office: 'es. Ufficio Ordini',
    },
    holidays: {
      title: 'Festività',
      subtitle: 'Gestisci il calendario delle festività',
      newHoliday: 'Nuova Festività',
      editHoliday: 'Modifica Festività',
      holidayCreated: 'Festività creata',
      holidayUpdated: 'Festività aggiornata',
      holidayDeleted: 'Festività "{name}" eliminata',
      noHolidaysFound: 'Nessuna festività configurata',
      region: 'Regione',
      national: 'Nazionale',
      selectDate: 'Seleziona data',
      regionOptional: 'es. Lombardia (lasciare vuoto per nazionale)',
    },
    aliases: {
      title: 'Alias Località',
      subtitle: 'Gestisci le mappature degli alias delle località',
      newAlias: 'Nuovo Alias',
      editAlias: 'Modifica Alias',
      aliasCreated: 'Alias creato',
      aliasUpdated: 'Alias aggiornato',
      noAliasesFound: 'Nessun alias trovato',
      searchPlaceholder: 'Cerca per alias o località...',
      alias: 'Alias',
      mapping: 'Mappatura',
      normalizedLocation: 'Località Normalizzata',
      aliasHint: 'es. METRO MILANO',
    },
    users: {
      title: 'Utenti',
      subtitle: 'Gestisci gli utenti e i loro permessi',
      newUser: 'Nuovo Utente',
      editUser: 'Modifica Utente',
      userCreated: 'Utente creato',
      userUpdated: 'Utente aggiornato',
      userDeleted: 'Utente {name} eliminato',
      noUsersFound: 'Nessun utente trovato',
      lastLogin: 'Ultimo Accesso',
      never: 'Mai',
      role: 'Ruolo',
      passwordHint: '(lasciare vuoto per non cambiare)',
      fullAccess: 'Accesso completo + gestione utenti',
      viewAndActions: 'Visualizza + azioni operative',
      viewOnly: 'Solo visualizzazione',
    },
    header: {
      consoleTitle: 'Brivio & Viganò Operations Console',
      notifications: 'Notifiche',
    },
    branding: {
      tagline: 'Gestione Ordini\nAutomatizzata',
      description: 'Console operativa per il monitoraggio e la gestione degli ordini di Brivio & Viganò.',
      copyright: '© 2024 Brivio & Viganò. Tutti i diritti riservati.',
    },
  },
};
