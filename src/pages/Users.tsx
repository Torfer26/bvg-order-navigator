import React, { useState } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage, interpolate } from '@/contexts/LanguageContext';
import type { User } from '@/types';
import { format } from 'date-fns';
import { es, it } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Shield, User as UserIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const mockUsers: User[] = [
  { id: '1', email: 'admin@bvg.com', name: 'Admin User', role: 'admin', createdAt: '2024-01-01T00:00:00Z', lastLogin: '2024-01-12T10:30:00Z' },
  { id: '2', email: 'ops@bvg.com', name: 'Ops User', role: 'ops', createdAt: '2024-01-01T00:00:00Z', lastLogin: '2024-01-12T09:15:00Z' },
  { id: '3', email: 'viewer@bvg.com', name: 'Viewer User', role: 'read', createdAt: '2024-01-01T00:00:00Z', lastLogin: '2024-01-11T16:45:00Z' },
  { id: '4', email: 'mario.rossi@bvg.com', name: 'Mario Rossi', role: 'ops', createdAt: '2024-02-15T00:00:00Z', lastLogin: '2024-01-12T08:00:00Z' },
  { id: '5', email: 'giulia.bianchi@bvg.com', name: 'Giulia Bianchi', role: 'read', createdAt: '2024-03-01T00:00:00Z' },
];

const roleColors: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  ops: 'secondary',
  read: 'outline',
};

export default function Users() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : it;
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ email: '', name: '', password: '', role: 'read' as User['role'] });

  const roleLabels = t.roles;

  const openNew = () => {
    setEditingUser(null);
    setFormData({ email: '', name: '', password: '', role: 'read' });
    setIsDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ email: user.email, name: user.name, password: '', role: user.role });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    toast.success(editingUser ? t.users.userUpdated : t.users.userCreated);
    setIsDialogOpen(false);
  };

  const handleDelete = (user: User) => {
    toast.success(interpolate(t.users.userDeleted, { name: user.name }));
  };

  const columns: Column<User>[] = [
    {
      key: 'user',
      header: t.common.name,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <UserIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-sm text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: t.users.role,
      cell: (row) => (
        <Badge variant={roleColors[row.role]} className="gap-1">
          <Shield className="h-3 w-3" />
          {roleLabels[row.role]}
        </Badge>
      ),
    },
    {
      key: 'lastLogin',
      header: t.users.lastLogin,
      cell: (row) =>
        row.lastLogin ? format(new Date(row.lastLogin), 'dd/MM/yyyy HH:mm', { locale: dateLocale }) : t.users.never,
    },
    {
      key: 'createdAt',
      header: t.common.created,
      cell: (row) => format(new Date(row.createdAt), 'dd/MM/yyyy', { locale: dateLocale }),
    },
    {
      key: 'actions',
      header: t.common.actions,
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => handleDelete(row)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">{t.users.title}</h1>
          <p className="page-description">{t.users.subtitle}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          {t.users.newUser}
        </Button>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="gap-1">
            <Shield className="h-3 w-3" />
            {roleLabels.admin}
          </Badge>
          <span className="text-sm text-muted-foreground">{t.users.fullAccess}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3" />
            {roleLabels.ops}
          </Badge>
          <span className="text-sm text-muted-foreground">{t.users.viewAndActions}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            {roleLabels.read}
          </Badge>
          <span className="text-sm text-muted-foreground">{t.users.viewOnly}</span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={mockUsers}
        keyExtractor={(row) => row.id}
        emptyMessage={t.users.noUsersFound}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? t.users.editUser : t.users.newUser}</DialogTitle>
            <DialogDescription>
              {editingUser ? t.users.editUser : t.users.newUser}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t.common.name}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Mario Rossi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t.common.email}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="mario.rossi@bvg.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                {t.auth.password} {editingUser && t.users.passwordHint}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.users.role}</Label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData({ ...formData, role: v as User['role'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{roleLabels.admin}</SelectItem>
                  <SelectItem value="ops">{roleLabels.ops}</SelectItem>
                  <SelectItem value="read">{roleLabels.read}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSave}>{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
