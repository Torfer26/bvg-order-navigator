import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  TrendingUp,
  Filter,
  Download
} from 'lucide-react';
import { KPICard } from '@/components/shared/KPICard';
import { Button } from '@/components/ui/button';
import { fetchEmailStats, fetchEmailTriage } from '@/lib/ordersService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function EmailMonitoring() {
  const [emailStats, setEmailStats] = useState<any[]>([]);
  const [emailTriage, setEmailTriage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'orders' | 'other'>('all');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [stats, triage] = await Promise.all([
          fetchEmailStats(),
          fetchEmailTriage(),
        ]);
        setEmailStats(stats);
        setEmailTriage(triage);
      } catch (error) {
        console.error('Error loading email monitoring data:', error);
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
  const statsToday = emailStats.filter((s) => new Date(s.receivedAt) >= today);
  const triageToday = emailTriage.filter((t) => new Date(t.createdAt) >= today);
  const orderEmailsToday = triageToday.filter((t) => t.isOrderEmail).length;
  const totalWithAttachments = statsToday.filter((s) => s.hasAttachments).length;

  // Get filtered emails
  const filteredEmails = selectedFilter === 'all' 
    ? emailStats
    : selectedFilter === 'orders'
    ? emailStats.filter((s) => {
        const triage = emailTriage.find((t) => t.messageId === s.messageId);
        return triage?.isOrderEmail;
      })
    : emailStats.filter((s) => {
        const triage = emailTriage.find((t) => t.messageId === s.messageId);
        return !triage?.isOrderEmail;
      });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Mail className="h-7 w-7" />
          Monitorización de Emails
        </h1>
        <p className="page-description">
          Análisis de emails recibidos y clasificación automática
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Emails Hoy"
          value={statsToday.length}
          icon={Mail}
          subtitle={`${emailStats.length} total`}
        />
        <KPICard
          title="Emails de Pedidos"
          value={orderEmailsToday}
          icon={FileText}
          subtitle="Clasificados automáticamente"
          iconClassName="bg-success/10"
        />
        <KPICard
          title="Con Adjuntos"
          value={totalWithAttachments}
          icon={CheckCircle2}
          subtitle={`${((totalWithAttachments / statsToday.length) * 100).toFixed(0)}% del total`}
          iconClassName="bg-info/10"
        />
        <KPICard
          title="Otros Emails"
          value={triageToday.length - orderEmailsToday}
          icon={AlertCircle}
          subtitle="No clasificados como pedidos"
          iconClassName="bg-warning/10"
        />
      </div>

      {/* Email Types Distribution */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title">Distribución de Tipos de Adjuntos</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 p-5">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Excel / CSV</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-success">
                {statsToday.reduce((acc, s) => acc + s.attachmentsExcel, 0)}
              </span>
              <span className="text-sm text-muted-foreground">archivos</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">PDF</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-info">
                {statsToday.reduce((acc, s) => acc + s.attachmentsPdf, 0)}
              </span>
              <span className="text-sm text-muted-foreground">archivos</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Otros</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-warning">
                {statsToday.reduce((acc, s) => acc + s.attachmentsOther, 0)}
              </span>
              <span className="text-sm text-muted-foreground">archivos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title">Emails Recibidos</h2>
          <div className="flex gap-2">
            <Button
              variant={selectedFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedFilter('all')}
            >
              Todos
            </Button>
            <Button
              variant={selectedFilter === 'orders' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedFilter('orders')}
            >
              Pedidos
            </Button>
            <Button
              variant={selectedFilter === 'other' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedFilter('other')}
            >
              Otros
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Fecha</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Remitente</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Asunto</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Tipo</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Adjuntos</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Cliente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEmails.slice(0, 50).map((email) => {
                const triage = emailTriage.find((t) => t.messageId === email.messageId);
                return (
                  <tr key={email.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-sm">
                      {format(new Date(email.receivedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium">{email.fromAddress}</div>
                      <div className="text-xs text-muted-foreground">{email.fromDomain}</div>
                    </td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate">
                      {email.subject}
                    </td>
                    <td className="px-4 py-3">
                      {triage?.isOrderEmail ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-success/10 text-success">
                          <FileText className="h-3 w-3" />
                          Pedido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground">
                          Otro
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {email.hasAttachments ? (
                        <div className="flex gap-1">
                          {email.attachmentsExcel > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-success/10 text-success">
                              Excel: {email.attachmentsExcel}
                            </span>
                          )}
                          {email.attachmentsPdf > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-info/10 text-info">
                              PDF: {email.attachmentsPdf}
                            </span>
                          )}
                          {email.attachmentsOther > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning">
                              Otro: {email.attachmentsOther}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin adjuntos</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {email.customerName || <span className="text-muted-foreground">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
