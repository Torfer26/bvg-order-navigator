import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Lock, Mail } from 'lucide-react';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const success = await login(email, password);
      if (success) {
        navigate('/dashboard');
      } else {
        setError(t.auth.invalidCredentials);
      }
    } catch (err) {
      setError(t.auth.loginError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden w-1/2 bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground">
              <span className="text-xl font-bold text-primary">BV</span>
            </div>
            <span className="text-2xl font-semibold text-primary-foreground">BVG Ops</span>
          </div>
        </div>
        
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight text-primary-foreground whitespace-pre-line">
            {t.branding.tagline}
          </h1>
          <p className="text-lg text-primary-foreground/80">
            {t.branding.description}
          </p>
        </div>

        <p className="text-sm text-primary-foreground/60">
          {t.branding.copyright}
        </p>
      </div>

      {/* Right side - Login form */}
      <div className="flex flex-1 flex-col px-8 py-12 lg:px-16">
        {/* Language switcher in top right */}
        <div className="flex justify-end mb-8">
          <LanguageSwitcher />
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                  <span className="text-lg font-bold text-primary-foreground">BV</span>
                </div>
                <span className="text-xl font-semibold">BVG Ops Console</span>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight">{t.auth.loginTitle}</h2>
              <p className="mt-2 text-muted-foreground">
                {t.auth.loginSubtitle}
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">{t.auth.email}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nombre@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t.auth.password}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t.auth.loggingIn}
                  </>
                ) : (
                  t.auth.loginButton
                )}
              </Button>
            </form>

            {/* Demo credentials */}
            <div className="mt-8 rounded-lg border border-border bg-muted/50 p-4">
              <p className="mb-2 text-sm font-medium">{t.auth.demoCredentials}</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p><strong>Admin:</strong> admin@bvg.com / admin123</p>
                <p><strong>Ops:</strong> ops@bvg.com / ops123</p>
                <p><strong>Viewer:</strong> viewer@bvg.com / view123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
