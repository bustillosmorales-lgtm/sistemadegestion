'use client';

/**
 * Página de Gestión de Usuarios (Solo Admin)
 * Permite crear, editar, asignar roles y ver auditoría
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/useSupabase';
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
import { UserPlus, Shield, Trash2, Eye, AlertCircle } from 'lucide-react';
import { ROLE_NAMES, type RoleId } from '@/lib/types/permissions';
import { useToast } from '@/hooks/useToast';
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
  const { client } = useSupabase();

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Obtener todos los usuarios de auth.users
      const { data, error } = await client.auth.admin.listUsers();

      if (error) throw error;

      // Obtener roles de cada usuario
      const usersWithRoles = await Promise.all(
        (data.users || []).map(async (user) => {
          const { data: roles } = await client
            .from('user_roles')
            .select('role_id')
            .eq('user_id', user.id);

          return {
            id: user.id,
            email: user.email || '',
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            roles: roles || [],
          };
        })
      );

      return usersWithRoles;
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
                  <div className="flex gap-2">
                    <ManageRolesDialog user={user} />
                    <ViewAuditDialog userId={user.id} userEmail={user.email} />
                  </div>
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
  const { client } = useSupabase();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const inviteMutation = useMutation({
    mutationFn: async () => {
      // 1. Crear usuario en auth
      const { data: newUser, error: createError } = await client.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      if (createError) throw createError;

      // 2. Asignar rol
      const { error: roleError } = await client.from('user_roles').insert({
        user_id: newUser.user.id,
        role_id: roleId,
      });

      if (roleError) throw roleError;

      return newUser;
    },
    onSuccess: () => {
      toast({
        title: 'Usuario invitado',
        description: `Se ha enviado un email de invitación a ${email}`,
      });
      setEmail('');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al invitar usuario',
        description: error.message,
        variant: 'destructive',
      });
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
  const { client } = useSupabase();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateRolesMutation = useMutation({
    mutationFn: async () => {
      // 1. Eliminar todos los roles actuales
      await client.from('user_roles').delete().eq('user_id', user.id);

      // 2. Insertar nuevos roles
      if (selectedRoles.length > 0) {
        const { error } = await client
          .from('user_roles')
          .insert(selectedRoles.map((role_id) => ({ user_id: user.id, role_id })));

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Roles actualizados', description: `Roles de ${user.email} actualizados` });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar roles',
        description: error.message,
        variant: 'destructive',
      });
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

// =====================================================
// Dialog: Ver Auditoría
// =====================================================

function ViewAuditDialog({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [open, setOpen] = useState(false);
  const { client } = useSupabase();

  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs', userId],
    queryFn: async () => {
      const { data, error } = await client
        .from('audit_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-1" />
          Auditoría
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial de Auditoría</DialogTitle>
          <DialogDescription>{userEmail}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {auditLogs?.map((log) => (
            <div key={log.id} className="border rounded p-3 text-sm">
              <div className="flex justify-between items-start">
                <div>
                  <Badge variant="outline">{log.action}</Badge>
                  <span className="ml-2 text-muted-foreground">{log.resource}</span>
                  {log.resource_id && (
                    <span className="ml-1 text-xs text-muted-foreground">#{log.resource_id}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                </span>
              </div>
              {log.metadata && (
                <pre className="text-xs text-muted-foreground mt-2 overflow-x-auto">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              )}
            </div>
          ))}
          {auditLogs?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No hay registros de auditoría</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
