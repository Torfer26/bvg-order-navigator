import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Mail, 
  FileText, 
  FileSpreadsheet,
  File,
  CheckCircle2, 
  Loader2,
  Calendar,
  ArrowRight,
  RefreshCw,
  Search,
  Clock,
  User,
  Paperclip,
  ExternalLink
} from 'lucide-react';
import { KPICard } from '@/components/shared/KPICard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { fetchEmailStats, fetchEmailTriageStats } from '@/lib/ordersService';
import { format, formatDistanceToNow, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface EmailRecord {
  id: string;
  receivedAt: string;
  messageId: string;
  fromAddress: string;
  fromDomain: string;
  subject: string;
  hasAttachments: boolean;
  attachmentsPdf: number;
  attachmentsExcel: number;
  attachmentsOther: number;
  customerName?: string;
  status?: string;
  source?: string;
  isProcessedAsOrder: boolean;
}

export interface TriageStats {
  totalToday: number;
  orderEmailsToday: number;
  nonOrderEmailsToday: number;
  percentOrdersToday: number;
}

export default function EmailMonitoring() {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [triageStats, setTriageStats] = useState<TriageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    
    try {
      const [data, stats] = await Promise.all([
        fetchEmailStats(),
        fetchEmailTriageStats(),
      ]);
      setEmails(data);
      setTriageStats(stats);
    } catch (error) {
      console.error('Error loading email monitoring data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Date filters
  const today = startOfDay(new Date());
  const weekAgo = subDays(today, 7);
  const monthAgo = subDays(today, 30);

  const getFilteredByPeriod = (data: EmailRecord[]) => {
    switch (selectedPeriod) {
      case 'today':
        return data.filter(e => new Date(e.receivedAt) >= today);
      case '7d':
        return data.filter(e => new Date(e.receivedAt) >= weekAgo);
      case '30d':
        return data.filter(e => new Date(e.receivedAt) >= monthAgo);
      default:
        return data;
    }
  };

  const periodEmails = getFilteredByPeriod(emails);
  
  // Search filter
  const filteredEmails = searchQuery
    ? periodEmails.filter(e => 
        e.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.fromAddress?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : periodEmails;

  // Calculate KPIs from real data
  const emailsToday = emails.filter(e => new Date(e.receivedAt) >= today).length;
  const emailsYesterday = emails.filter(e => {
    const date = new Date(e.receivedAt);
    const yesterday = subDays(today, 1);
    return date >= yesterday && date < today;
  }).length;

  const withAttachments = periodEmails.filter(e => e.hasAttachments).length;
  const withExcel = periodEmails.filter(e => e.attachmentsExcel > 0).length;
  const withPdf = periodEmails.filter(e => e.attachmentsPdf > 0).length;
  
  const totalExcel = periodEmails.reduce((acc, e) => acc + e.attachmentsExcel, 0);
  const totalPdf = periodEmails.reduce((acc, e) => acc + e.attachmentsPdf, 0);
  const totalOther = periodEmails.reduce((acc, e) => acc + e.attachmentsOther, 0);

  // Unique senders
  const uniqueSenders = new Set(periodEmails.map(e => e.fromAddress).filter(Boolean)).size;
  
  // Unique customers
  const uniqueCustomers = new Set(periodEmails.map(e => e.customerName).filter(Boolean)).size;

  // Period label
  const periodLabel = selectedPeriod === 'today' ? 'hoy' : 
                      selectedPeriod === '7d' ? 'últimos 7 días' : 
                      selectedPeriod === '30d' ? 'últimos 30 días' : 'total';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="page-header">
          <h1 className="page-title flex items-center gap-2">
            <Mail className="h-7 w-7" />
            Emails Procesados
          </h1>
          <p className="page-description">
            Emails recibidos que han sido procesados como pedidos
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => loadData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Periodo:</span>
        <div className="flex gap-1">
          {[
            { value: 'today', label: 'Hoy' },
            { value: '7d', label: '7 días' },
            { value: '30d', label: '30 días' },
            { value: 'all', label: 'Todo' },
          ].map(({ value, label }) => (
            <Button
              key={value}
              variant={selectedPeriod === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod(value as any)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Clasificación AI (triaje) - % pedidos vs no-pedidos */}
      {triageStats && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <h3 className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Clasificación de correos (triaje AI)
          </h3>
          <div className="flex flex-wrap items-baseline gap-4">
            <span className="text-2xl font-bold">{triageStats.totalToday}</span>
            <span className="text-muted-foreground">clasificados hoy</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium text-green-700">{triageStats.orderEmailsToday} pedidos</span>
            <span className="text-lg font-semibold text-primary">
              ({triageStats.percentOrdersToday}%)
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium text-slate-600">{triageStats.nonOrderEmailsToday} otros</span>
            <span className="text-sm text-muted-foreground">
              ({triageStats.totalToday > 0 ? 100 - triageStats.percentOrdersToday : 0}%)
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Correos clasificados por el triaje AI como pedido o no-pedido antes del procesamiento.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Emails Procesados Hoy"
          value={emailsToday}
          icon={Mail}
          subtitle={`${periodEmails.length} ${periodLabel}`}
          trend={emailsYesterday > 0 ? {
            value: Math.abs(Math.round(((emailsToday - emailsYesterday) / emailsYesterday) * 100)),
            isPositive: emailsToday >= emailsYesterday
          } : undefined}
        />
        <KPICard
          title="Con Excel/CSV"
          value={withExcel}
          icon={FileSpreadsheet}
          subtitle={`${totalExcel} archivos en total`}
          iconClassName="bg-success/10"
        />
        <KPICard
          title="Con PDF"
          value={withPdf}
          icon={FileText}
          subtitle={`${totalPdf} archivos en total`}
          iconClassName="bg-info/10"
        />
        <KPICard
          title="Remitentes Únicos"
          value={uniqueSenders}
          icon={User}
          subtitle={`${uniqueCustomers} clientes identificados`}
          iconClassName="bg-primary/10"
        />
      </div>

      {/* Attachment Distribution */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Distribución de Adjuntos ({periodLabel})
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 p-5">
          <div className="rounded-lg border border-green-200 bg-green-50/50 p-4">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <FileSpreadsheet className="h-4 w-4" />
              Excel / CSV
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-green-700">{totalExcel}</span>
              <span className="text-sm text-green-600">archivos</span>
            </div>
            <div className="mt-1 text-xs text-green-600">
              {withExcel} emails con adjuntos Excel
            </div>
          </div>
          
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <FileText className="h-4 w-4" />
              PDF
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-blue-700">{totalPdf}</span>
              <span className="text-sm text-blue-600">archivos</span>
            </div>
            <div className="mt-1 text-xs text-blue-600">
              {withPdf} emails con adjuntos PDF
            </div>
          </div>
          
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <File className="h-4 w-4" />
              Otros
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-slate-700">{totalOther}</span>
              <span className="text-sm text-slate-600">archivos</span>
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Imágenes, documentos, etc.
            </div>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Emails Procesados
            <Badge variant="secondary" className="ml-2">
              {filteredEmails.length}
            </Badge>
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por asunto, remitente, cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
          </div>
        </div>
        
        {filteredEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Mail className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-3 font-medium">No hay emails en este periodo</p>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'Intenta con otros términos de búsqueda' : 'Selecciona otro rango de fechas'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Remitente</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Asunto</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Adjuntos</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEmails.slice(0, 50).map((email) => (
                  <tr key={email.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {format(new Date(email.receivedAt), 'dd MMM yyyy', { locale: es })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(email.receivedAt), 'HH:mm')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {email.fromAddress ? (
                        <div>
                          <div className="font-medium truncate max-w-[200px]">{email.fromAddress}</div>
                          {email.fromDomain && (
                            <div className="text-xs text-muted-foreground">{email.fromDomain}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No disponible</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="max-w-xs truncate" title={email.subject}>
                        {email.subject || '(Sin asunto)'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {email.hasAttachments ? (
                        <div className="flex flex-wrap gap-1">
                          {email.attachmentsExcel > 0 && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <FileSpreadsheet className="h-3 w-3 mr-1" />
                              {email.attachmentsExcel}
                            </Badge>
                          )}
                          {email.attachmentsPdf > 0 && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              <FileText className="h-3 w-3 mr-1" />
                              {email.attachmentsPdf}
                            </Badge>
                          )}
                          {email.attachmentsOther > 0 && (
                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                              <File className="h-3 w-3 mr-1" />
                              {email.attachmentsOther}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin adjuntos</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {email.customerName ? (
                        <div className="font-medium text-primary truncate max-w-[150px]" title={email.customerName}>
                          {email.customerName}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {email.status && (
                        <Badge 
                          variant="outline" 
                          className={
                            email.status === 'COMPLETED' || email.status === 'PROCESSING' 
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : email.status === 'ERROR'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }
                        >
                          {email.status}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/orders/${email.id}`} className="gap-1">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredEmails.length > 50 && (
              <div className="px-4 py-3 text-center text-sm text-muted-foreground border-t">
                Mostrando 50 de {filteredEmails.length} emails
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
