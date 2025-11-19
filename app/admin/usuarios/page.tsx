'use client';

/**
 * Página de Gestión de Usuarios (Solo Admin)
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/lib/SupabaseProvider';
import { AdminOnly } from '@/components/auth/Protected';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Shield, AlertCircle } from 'lucide-react';
import { ROLE_NAMES, type RoleId } from '@/lib/types/permissions';
import { showSuccess, showError } from '@/lib/utils/toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface UserWithRoles {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  roles: { role_id: RoleId }[];
}

export default function UsuariosPage() {
  return (
    <AdminOnly showDenied>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
            <p className="text-muted-foreground mt-1">
              Administra usuarios, roles y permisos del sistema
            </p>
          </div>
          <InviteUserDialog />
        </div>

        <UsersTable />
      </div>
    </AdminOnly>
  );
}

// =====================================================
// Tabla de Usuarios
// =====================================================

function UsersTable() {
  const { session } = useSupabase();

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      if (!session?.access_token) {
        throw new Error('No autenticado');
      }

      const response = await fetch('/.netlify/functions/admin-list-users', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al cargar usuarios');
      }

      const data = await response.json();
      return data.users as UserWithRoles[];
    },
    staleTime: 2 * 60 * 1000,
  });

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Error al cargar usuarios: {(error as Error).message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Cargando usuarios...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios del Sistema</CardTitle>
        <CardDescription>
          {users?.length || 0} usuario(s) registrado(s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Último acceso</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {user.roles.length === 0 ? (
                      <Badge variant="outline">Sin rol</Badge>
                    ) : (
                      user.roles.map((r) => (
                        <Badge key={r.role_id} variant="secondary">
                          {ROLE_NAMES[r.role_id]}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {user.last_sign_in_at
                    ? format(new Date(user.last_sign_in_at), 'dd MMM yyyy HH:mm', {
                        locale: es,
                      })
                    : 'Nunca'}
                </TableCell>
                <TableCell>
                  {format(new Date(user.created_at), 'dd MMM yyyy', { locale: es })}
                </TableCell>
                <TableCell>
                  <ManageRolesDialog user={user} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// =====================================================
// Dialog: Invitar Usuario
// =====================================================

function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState<RoleId>('OPERADOR');
  const queryClient = useQueryClient();
  const { session } = useSupabase();

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) {
        throw new Error('No autenticado');
      }

      const response = await fetch('/.netlify/functions/admin-create-user', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, roleId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear usuario');
      }

      return response.json();
    },
    onSuccess: () => {
      showSuccess(`Usuario invitado: ${email}`);
      setEmail('');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Invitar Usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar Nuevo Usuario</DialogTitle>
          <DialogDescription>
            El usuario recibirá un email para establecer su contraseña
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="role">Rol Inicial</Label>
            <Select value={roleId} onValueChange={(v) => setRoleId(v as RoleId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_NAMES).map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => inviteMutation.mutate()}
            disabled={!email || inviteMutation.isPending}
          >
            {inviteMutation.isPending ? 'Invitando...' : 'Enviar Invitación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// Dialog: Gestionar Roles
// =====================================================

function ManageRolesDialog({ user }: { user: UserWithRoles }) {
  const [open, setOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<RoleId[]>(
    user.roles.map((r) => r.role_id)
  );
  const queryClient = useQueryClient();
  const { session } = useSupabase();

  const updateRolesMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) {
        throw new Error('No autenticado');
      }

      const response = await fetch('/.netlify/functions/admin-update-user-roles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id, roleIds: selectedRoles }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar roles');
      }

      return response.json();
    },
    onSuccess: () => {
      showSuccess(`Roles actualizados: ${user.email}`);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const toggleRole = (roleId: RoleId) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Shield className="h-4 w-4 mr-1" />
          Roles
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gestionar Roles</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {Object.entries(ROLE_NAMES).map(([id, name]) => (
            <div key={id} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`role-${id}`}
                checked={selectedRoles.includes(id as RoleId)}
                onChange={() => toggleRole(id as RoleId)}
                className="h-4 w-4"
              />
              <label htmlFor={`role-${id}`} className="text-sm font-medium cursor-pointer">
                {name}
              </label>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => updateRolesMutation.mutate()}
            disabled={updateRolesMutation.isPending}
          >
            {updateRolesMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
