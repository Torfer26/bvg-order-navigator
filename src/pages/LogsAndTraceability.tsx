import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Loader2,
  Search,
  Filter,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchOrdersLog, fetchOrderEvents } from '@/lib/ordersService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function LogsAndTraceability() {
  const [logs, setLogs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'logs' | 'events'>('logs');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'OK' | 'ERROR' | 'WARN'>('all');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [logsData, eventsData] = await Promise.all([
          fetchOrdersLog(),
          fetchOrderEvents(),
        ]);
        setLogs(logsData);
        setEvents(eventsData);
      } catch (error) {
        console.error('Error loading logs and events:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const logsToday = logs.filter((l) => new Date(l.createdAt) >= today);
  const eventsToday = events.filter((e) => new Date(e.createdAt) >= today);

  const successLogs = logsToday.filter((l) => l.status === 'OK').length;
  const errorLogs = logsToday.filter((l) => l.status === 'ERROR').length;
  const warnLogs = logsToday.filter((l) => l.status === 'WARN').length;

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    const matchesSearch = !searchTerm || 
      log.messageId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.step?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'ERROR':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'WARN':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'OK':
        return 'bg-success/10 text-success';
      case 'ERROR':
        return 'bg-destructive/10 text-destructive';
      case 'WARN':
        return 'bg-warning/10 text-warning';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <GitBranch className="h-7 w-7" />
          Logs y Trazabilidad
        </h1>
        <p className="page-description">
          Seguimiento detallado de procesamiento y eventos del sistema
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="section-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Activity className="h-4 w-4" />
            Logs Hoy
          </div>
          <div className="text-2xl font-semibold">{logsToday.length}</div>
        </div>
        <div className="section-card p-4">
          <div className="flex items-center gap-2 text-sm text-success mb-1">
            <CheckCircle2 className="h-4 w-4" />
            Exitosos
          </div>
          <div className="text-2xl font-semibold text-success">{successLogs}</div>
        </div>
        <div className="section-card p-4">
          <div className="flex items-center gap-2 text-sm text-destructive mb-1">
            <AlertCircle className="h-4 w-4" />
            Errores
          </div>
          <div className="text-2xl font-semibold text-destructive">{errorLogs}</div>
        </div>
        <div className="section-card p-4">
          <div className="flex items-center gap-2 text-sm text-warning mb-1">
            <AlertTriangle className="h-4 w-4" />
            Advertencias
          </div>
          <div className="text-2xl font-semibold text-warning">{warnLogs}</div>
        </div>
      </div>

      {/* Filters and View Selector */}
      <div className="section-card">
        <div className="flex flex-col sm:flex-row gap-4 p-4 border-b border-border">
          <div className="flex gap-2">
            <Button
              variant={selectedView === 'logs' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedView('logs')}
            >
              <GitBranch className="h-4 w-4 mr-2" />
              Logs de Procesamiento ({logs.length})
            </Button>
            <Button
              variant={selectedView === 'events' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedView('events')}
            >
              <Activity className="h-4 w-4 mr-2" />
              Eventos de Negocio ({events.length})
            </Button>
          </div>
          
          {selectedView === 'logs' && (
            <>
              <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por message ID o step..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                >
                  Todos
                </Button>
                <Button
                  variant={statusFilter === 'OK' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('OK')}
                  className="text-success"
                >
                  OK
                </Button>
                <Button
                  variant={statusFilter === 'ERROR' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('ERROR')}
                  className="text-destructive"
                >
                  Error
                </Button>
                <Button
                  variant={statusFilter === 'WARN' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('WARN')}
                  className="text-warning"
                >
                  Warn
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Logs Table */}
        {selectedView === 'logs' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Timestamp</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Message ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Step</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.slice(0, 100).map((log) => (
                  <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-xs max-w-xs truncate">
                      {log.messageId}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">{log.step}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(log.status)}`}>
                        {getStatusIcon(log.status)}
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm max-w-md">
                      {log.info && (
                        <details className="cursor-pointer">
                          <summary className="text-xs text-muted-foreground hover:text-foreground">
                            Ver detalles
                          </summary>
                          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                            {JSON.stringify(log.info, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Events Table */}
        {selectedView === 'events' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Timestamp</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Intake ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Tipo de Evento</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Datos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.slice(0, 100).map((event) => (
                  <tr key={event.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {format(new Date(event.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {event.intakeId || <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">{event.eventType}</span>
                    </td>
                    <td className="px-4 py-3 text-sm max-w-md">
                      {event.eventData && (
                        <details className="cursor-pointer">
                          <summary className="text-xs text-muted-foreground hover:text-foreground">
                            Ver datos del evento
                          </summary>
                          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                            {JSON.stringify(event.eventData, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
