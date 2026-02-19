import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  MapPin,
  AlertTriangle,
  FileDown,
  RefreshCw,
  ExternalLink,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchExtractionMetrics, type ExtractionMetrics } from '@/lib/ordersService';
import { useAuth } from '@/contexts/AuthContext';

const COPY_COMMANDS = {
  exportGolden: 'psql -h localhost -U railway -d railway -f scripts/export-golden-set.sql -o golden-set.csv -A -F \',\'',
  syncAliases: 'psql -h localhost -U railway -d railway -f scripts/sync-aliases-from-feedback.sql',
};

export default function ExtractionEvaluation() {
  const { hasRole } = useAuth();
  const [metrics, setMetrics] = useState<ExtractionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const m = await fetchExtractionMetrics();
      setMetrics(m);
    } catch (error) {
      console.error('Error loading extraction metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (key: keyof typeof COPY_COMMANDS) => {
    navigator.clipboard.writeText(COPY_COMMANDS[key]);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const isAdmin = hasRole(['admin']);
  const showOpsSection = hasRole(['admin', 'ops']);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Evaluación de Extracción</h1>
        <p className="page-description">
          Métricas y guía operativa para la mejora continua de la extracción de pedidos
        </p>
      </div>

      {/* Métricas en tiempo real */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Correcciones registradas</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.extractionFeedbackTotal ?? 0}</div>
            <p className="text-xs text-muted-foreground">extraction_feedback</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Líneas con ubicación manual</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.linesManuallySetTotal ?? 0}</div>
            <p className="text-xs text-muted-foreground">MANUALLY_SET</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de corrección</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.correctionRatePct != null ? `${metrics.correctionRatePct}%` : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.totalLinesWithDestination != null
                ? `sobre ${metrics.totalLinesWithDestination} líneas con destino`
                : 'Sobre líneas con destino'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos en DLQ</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.dlqOrdersTotal ?? 0}</div>
            <Button variant="ghost" size="sm" className="mt-1 h-auto p-0 text-xs" asChild>
              <Link to="/dlq">Ver DLQ</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={loadMetrics}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar métricas
        </Button>
      </div>

      {/* Operación y mejores prácticas */}
      {showOpsSection && (
        <Card>
          <CardHeader>
            <CardTitle>Guía operativa</CardTitle>
            <CardDescription>
              Comandos y frecuencias recomendadas. Runbook completo:{' '}
              <code className="text-xs">docs/reference/EXTRACTION-EVALUATION-RUNBOOK.md</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <FileDown className="h-4 w-4" />
                Exportar golden set (mensual o ~50–100 correcciones)
              </h4>
              <div className="flex gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm overflow-x-auto">
                  {COPY_COMMANDS.exportGolden}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard('exportGolden')}
                  title="Copiar"
                >
                  {copied === 'exportGolden' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Sincronizar aliases desde feedback (semanal)
              </h4>
              <div className="flex gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm overflow-x-auto">
                  {COPY_COMMANDS.syncAliases}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard('syncAliases')}
                  title="Copiar"
                >
                  {copied === 'syncAliases' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium mb-2">Frecuencias recomendadas</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Golden set: mensual o al acumular ~50–100 correcciones</li>
                <li>Métricas: semanal o uso continuo de Grafana</li>
                <li>Sync aliases: semanal, con volumen razonable</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enlace a Grafana (admin) */}
      {isAdmin && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Métricas detalladas en Grafana → BVG Stack - Overview → fila &quot;Extraction Evaluation&quot;
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href="/grafana" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir Grafana
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
