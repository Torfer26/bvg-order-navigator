import React, { useState, useEffect, useCallback } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage, interpolate } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Shield, 
  User as UserIcon, 
  RefreshCw,
  UserCheck,
  UserX,
  MoreHorizontal,
  Activity
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  reactivateUser,
  fetchUserStats,
  type PlatformUser,
  type UserRole,
  type UserStatus,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  STATUS_LABELS,
} from '@/lib/usersService';

// ============================================================================
// Constants
// ============================================================================

const roleColors: Record<UserRole, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  ops: 'secondary',
  read: 'outline',
};

const statusColors: Record<UserStatus, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
};

// ============================================================================
// Component
// ============================================================================

export default function Users() {
  const { t, language } = useLanguage();
  const { user: currentUser, hasRole, platformUser } = useAuth();
  const dateLocale = language === 'es' ? es : it;
  
  // State
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<PlatformUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState<{
    total: number;
    byRole: Record<UserRole, number>;
    activeLastWeek: number;
  } | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'read' as UserRole,
    department: '',
    phone: '',
  });

  const roleLabels = t.roles || { admin: 'Admin', ops: 'Operador', read: 'Lectura' };
  const isAdmin = hasRole(['admin']);
  const currentUserId = platformUser?.id;

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersData, statsData] = await Promise.all([
        fetchUsers(),
        fetchUserStats(),
      ]);
      setUsers(usersData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ============================================================================
  // Actions
  // ============================================================================

  const openNew = () => {
    if (!isAdmin) {
      toast.error('No tienes permisos para crear usuarios');
      return;
    }
    setEditingUser(null);
    setFormData({ email: '', name: '', role: 'read', department: '', phone: '' });
    setIsDialogOpen(true);
  };

  const openEdit = (user: PlatformUser) => {
    if (!isAdmin) {
      toast.error('No tienes permisos para editar usuarios');
      return;
    }
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department || '',
      phone: user.phone || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.email || !formData.name) {
      toast.error('Email y nombre son obligatorios');
      return;
    }

    setIsSaving(true);
    try {
      if (editingUser) {
        // Update existing user
        const result = await updateUser(
          editingUser.id,
          {
            name: formData.name,
            role: formData.role,
            department: formData.department || undefined,
            phone: formData.phone || undefined,
          },
          currentUserId
        );

        if (result.success) {
          toast.success(result.message);
          setIsDialogOpen(false);
          loadData();
        } else {
          toast.error(result.message);
        }
      } else {
        // Create new user
        const result = await createUser(
          {
            email: formData.email,
            name: formData.name,
            role: formData.role,
            department: formData.department || undefined,
            phone: formData.phone || undefined,
          },
          currentUserId
        );

        if (result.success) {
          toast.success(result.message);
          setIsDialogOpen(false);
          loadData();
        } else {
          toast.error(result.message);
        }
      }
    } catch (error) {
      toast.error('Error al guardar usuario');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmUser) return;

    try {
      const result = await deleteUser(deleteConfirmUser.id, currentUserId);
      if (result.success) {
        toast.success(result.message);
        loadData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Error al desactivar usuario');
    } finally {
      setDeleteConfirmUser(null);
    }
  };

  const handleReactivate = async (user: PlatformUser) => {
    try {
      const result = await reactivateUser(user.id, currentUserId);
      if (result.success) {
        toast.success(result.message);
        loadData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Error al reactivar usuario');
    }
  };

  // ============================================================================
  // Table Columns
  // ============================================================================

  const columns: Column<PlatformUser>[] = [
    {
      key: 'user',
      header: t.common?.name || 'Nombre',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <UserIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{row.name}</p>
              {row.id === currentUserId && (
                <Badge variant="outline" className="text-xs">Tú</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: t.users?.role || 'Rol',
      cell: (row) => (
        <Badge variant={roleColors[row.role]} className="gap-1">
          <Shield className="h-3 w-3" />
          {roleLabels[row.role] || ROLE_LABELS[row.role]}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (row) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[row.status]}`}>
          {row.status === 'active' ? (
            <UserCheck className="h-3 w-3 mr-1" />
          ) : (
            <UserX className="h-3 w-3 mr-1" />
          )}
          {STATUS_LABELS[row.status]}
        </span>
      ),
    },
    {
      key: 'lastLogin',
      header: t.users?.lastLogin || 'Último acceso',
      cell: (row) =>
        row.lastLoginAt 
          ? format(new Date(row.lastLoginAt), 'dd/MM/yyyy HH:mm', { locale: dateLocale }) 
          : <span className="text-muted-foreground">{t.users?.never || 'Nunca'}</span>,
    },
    {
      key: 'createdAt',
      header: t.common?.created || 'Creado',
      cell: (row) => format(new Date(row.createdAt), 'dd/MM/yyyy', { locale: dateLocale }),
    },
    {
      key: 'actions',
      header: t.common?.actions || 'Acciones',
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={!isAdmin}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row)}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {row.status === 'active' ? (
              <DropdownMenuItem 
                onClick={() => setDeleteConfirmUser(row)}
                className="text-destructive"
                disabled={row.id === currentUserId}
              >
                <UserX className="h-4 w-4 mr-2" />
                Desactivar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => handleReactivate(row)}>
                <UserCheck className="h-4 w-4 mr-2" />
                Reactivar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">{t.users?.title || 'Usuarios'}</h1>
          <p className="page-description">{t.users?.subtitle || 'Gestiona los usuarios y sus permisos'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
          {isAdmin && (
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              {t.users?.newUser || 'Nuevo usuario'}
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <UserIcon className="h-4 w-4" />
              <span className="text-sm">Total usuarios</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Shield className="h-4 w-4" />
              <span className="text-sm">Administradores</span>
            </div>
            <p className="text-2xl font-bold">{stats.byRole.admin}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <UserCheck className="h-4 w-4" />
              <span className="text-sm">Operadores</span>
            </div>
            <p className="text-2xl font-bold">{stats.byRole.ops}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-sm">Activos (7 días)</span>
            </div>
            <p className="text-2xl font-bold">{stats.activeLastWeek}</p>
          </div>
        </div>
      )}

      {/* Role legend */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="gap-1">
            <Shield className="h-3 w-3" />
            {roleLabels.admin || 'Admin'}
          </Badge>
          <span className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS.admin}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3" />
            {roleLabels.ops || 'Operador'}
          </Badge>
          <span className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS.ops}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            {roleLabels.read || 'Lectura'}
          </Badge>
          <span className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS.read}</span>
        </div>
      </div>

      {/* Users Table */}
      <DataTable
        columns={columns}
        data={users}
        keyExtractor={(row) => String(row.id)}
        emptyMessage={t.users?.noUsersFound || 'No se encontraron usuarios'}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Editar usuario' : 'Nuevo usuario'}
            </DialogTitle>
            <DialogDescription>
              {editingUser 
                ? 'Modifica los datos del usuario. Los cambios de rol se aplicarán en su próximo acceso.'
                : 'Crea un nuevo usuario. El usuario podrá acceder cuando se autentique por Cloudflare Access.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t.common?.name || 'Nombre'} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t.common?.email || 'Email'} *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="usuario@empresa.com"
                disabled={!!editingUser} // Can't change email
              />
              {editingUser && (
                <p className="text-xs text-muted-foreground">El email no se puede modificar</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t.users?.role || 'Rol'}</Label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData({ ...formData, role: v as UserRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="h-5">{roleLabels.admin || 'Admin'}</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="ops">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-5">{roleLabels.ops || 'Operador'}</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="read">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="h-5">{roleLabels.read || 'Lectura'}</Badge>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Departamento</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="Logística"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+34 600 000 000"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              {t.common?.cancel || 'Cancelar'}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Guardando...' : (t.common?.save || 'Guardar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmUser} onOpenChange={() => setDeleteConfirmUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              El usuario <strong>{deleteConfirmUser?.name}</strong> ({deleteConfirmUser?.email}) 
              será desactivado y no podrá acceder a la plataforma. 
              Podrás reactivarlo en cualquier momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
