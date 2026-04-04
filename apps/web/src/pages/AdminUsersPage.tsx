import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconUsers,
  IconUserPlus,
  IconTrash,
  IconPencil,
  IconShield,
  IconSchool,
  IconMoodKid,
  IconArrowLeft,
  IconSearch,
} from '@tabler/icons-react';

import { useAuthStore } from '@/features/auth/stores/auth.store';
import { api } from '@/services/api';
import { Button, Spinner, Input } from '@/components/ui';

interface UserItem {
  id: string;
  email: string;
  username?: string;
  name: string;
  role: string;
  createdAt: string;
}

interface CreateUserForm {
  email: string;
  password: string;
  name: string;
  username: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
}

const ROLE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  ADMIN: {
    label: 'Administrador',
    icon: <IconShield className="w-4 h-4" />,
    color: 'text-rose-600',
    bg: 'bg-rose-50 border-rose-200',
  },
  TEACHER: {
    label: 'Profesor',
    icon: <IconSchool className="w-4 h-4" />,
    color: 'text-violet-600',
    bg: 'bg-violet-50 border-violet-200',
  },
  STUDENT: {
    label: 'Alumno',
    icon: <IconMoodKid className="w-4 h-4" />,
    color: 'text-sky-600',
    bg: 'bg-sky-50 border-sky-200',
  },
};

export function AdminUsersPage() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: '',
    password: '',
    name: '',
    username: '',
    role: 'TEACHER',
  });
  const [isCreating, setIsCreating] = useState(false);

  // Edit role modal
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete confirmation
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.listUsers({
        role: roleFilter || undefined,
        search: search || undefined,
        page,
        limit: 20,
      });
      setUsers(result.users as unknown as UserItem[]);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, roleFilter]);

  const handleSearch = () => {
    setPage(1);
    loadUsers();
  };

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password || !createForm.name) {
      setError('Email, contraseña y nombre son requeridos');
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      await api.adminCreateUser({
        ...createForm,
        username: createForm.username || undefined,
      });
      setSuccess(`Usuario ${createForm.email} creado correctamente`);
      setShowCreateForm(false);
      setCreateForm({ email: '', password: '', name: '', username: '', role: 'TEACHER' });
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear usuario');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!editUserId || !editRole) return;
    setIsUpdating(true);
    setError(null);
    try {
      await api.adminUpdateUserRole(editUserId, editRole);
      setSuccess('Rol actualizado correctamente');
      setEditUserId(null);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar rol');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUserId) return;
    setIsDeleting(true);
    setError(null);
    try {
      await api.adminDeleteUser(deleteUserId);
      setSuccess('Usuario eliminado correctamente');
      setDeleteUserId(null);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar usuario');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b-4 border-violet-200 shadow-gummy shadow-violet-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="text-violet-500 hover:text-violet-700 transition-colors p-2 rounded-xl hover:bg-violet-50"
            >
              <IconArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-2xl font-black text-violet-700 tracking-tight flex items-center gap-2">
              <IconUsers className="w-8 h-8 text-violet-500" stroke={2.5} />
              Gestión de Usuarios
            </h1>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2"
          >
            <IconUserPlus className="w-5 h-5" />
            Crear Usuario
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Notifications */}
        {error ? (
          <div className="mb-6 bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 text-rose-700 font-bold flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">
              ×
            </button>
          </div>
        ) : null}
        {success ? (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 text-emerald-700 font-bold flex items-center justify-between">
            <span>{success}</span>
            <button
              onClick={() => setSuccess(null)}
              className="text-emerald-400 hover:text-emerald-600"
            >
              ×
            </button>
          </div>
        ) : null}

        {/* Create User Form */}
        {showCreateForm ? (
          <div className="mb-8 bg-white rounded-[2rem] p-6 border-4 border-violet-200 shadow-gummy shadow-violet-200 animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-black text-violet-800 mb-4 flex items-center gap-2">
              <IconUserPlus className="w-6 h-6" />
              Crear Nuevo Usuario
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombre completo"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Nombre del usuario"
              />
              <Input
                label="Correo electrónico"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
              <Input
                label="Nombre de usuario (opcional)"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                placeholder="nombre_usuario"
              />
              <Input
                label="Contraseña"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1.5">Rol</label>
                <div className="flex gap-2">
                  {(['TEACHER', 'ADMIN'] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => setCreateForm({ ...createForm, role })}
                      className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                        createForm.role === role
                          ? `${ROLE_CONFIG[role].bg} ${ROLE_CONFIG[role].color} border-current shadow-sm`
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {ROLE_CONFIG[role].icon}
                      {ROLE_CONFIG[role].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleCreate} isLoading={isCreating} variant="primary">
                Crear Usuario
              </Button>
              <Button onClick={() => setShowCreateForm(false)} variant="secondary">
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email o usuario..."
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} variant="primary" size="md">
              <IconSearch className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setRoleFilter('');
                setPage(1);
              }}
              className={`px-4 py-2 rounded-xl border-2 font-bold text-sm transition-all ${
                !roleFilter
                  ? 'bg-violet-100 text-violet-700 border-violet-300'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Todos
            </button>
            {Object.entries(ROLE_CONFIG).map(([role, config]) => (
              <button
                key={role}
                onClick={() => {
                  setRoleFilter(role);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-xl border-2 font-bold text-sm flex items-center gap-1.5 transition-all ${
                  roleFilter === role
                    ? `${config.bg} ${config.color} border-current`
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {config.icon}
                {config.label}s
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 text-sm font-bold text-slate-500">
          {total} usuario{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </div>

        {/* Users Table */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Spinner size="lg" className="text-violet-500" />
            <p className="text-lg font-black text-violet-600 animate-pulse">Cargando usuarios...</p>
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] border-4 border-violet-200 shadow-gummy shadow-violet-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-violet-50 border-b-2 border-violet-100">
                    <th className="text-left px-6 py-4 text-sm font-black text-violet-700 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-black text-violet-700 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-black text-violet-700 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-black text-violet-700 uppercase tracking-wider">
                      Registro
                    </th>
                    <th className="text-right px-6 py-4 text-sm font-black text-violet-700 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-violet-50">
                  {users.map((u) => {
                    const roleConfig = ROLE_CONFIG[u.role] || ROLE_CONFIG.STUDENT;
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className="hover:bg-violet-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-indigo-400 flex items-center justify-center text-white font-bold text-lg">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{u.name}</p>
                              {u.username ? (
                                <p className="text-xs text-slate-400 font-medium">@{u.username}</p>
                              ) : null}
                            </div>
                            {isSelf ? (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-200">
                                Tú
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 font-medium">{u.email}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${roleConfig.bg} ${roleConfig.color}`}
                          >
                            {roleConfig.icon}
                            {roleConfig.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                          {new Date(u.createdAt).toLocaleDateString('es-AR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditUserId(u.id);
                                setEditRole(u.role);
                              }}
                              disabled={isSelf}
                              className="p-2 rounded-xl text-violet-500 hover:bg-violet-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title={isSelf ? 'No puedes cambiar tu propio rol' : 'Cambiar rol'}
                            >
                              <IconPencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteUserId(u.id)}
                              disabled={isSelf}
                              className="p-2 rounded-xl text-rose-500 hover:bg-rose-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title={isSelf ? 'No puedes eliminarte' : 'Eliminar usuario'}
                            >
                              <IconTrash className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold">
                        No se encontraron usuarios
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 ? (
              <div className="flex items-center justify-between px-6 py-4 border-t-2 border-violet-100 bg-violet-50/50">
                <p className="text-sm font-bold text-slate-500">
                  Página {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    variant="secondary"
                    size="sm"
                  >
                    Anterior
                  </Button>
                  <Button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    variant="secondary"
                    size="sm"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Edit Role Modal */}
        {editUserId ? (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2rem] p-6 max-w-md w-full border-4 border-violet-200 shadow-2xl animate-in fade-in zoom-in-95">
              <h3 className="text-xl font-black text-violet-800 mb-4">Cambiar Rol</h3>
              <p className="text-sm text-slate-500 font-medium mb-4">
                Selecciona el nuevo rol para este usuario:
              </p>
              <div className="space-y-2">
                {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                  <button
                    key={role}
                    onClick={() => setEditRole(role)}
                    className={`w-full py-3 px-4 rounded-xl border-2 font-bold text-sm flex items-center gap-3 transition-all ${
                      editRole === role
                        ? `${config.bg} ${config.color} border-current shadow-sm`
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {config.icon}
                    {config.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <Button onClick={handleUpdateRole} isLoading={isUpdating} variant="primary">
                  Guardar
                </Button>
                <Button onClick={() => setEditUserId(null)} variant="secondary">
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Delete Confirmation Modal */}
        {deleteUserId ? (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2rem] p-6 max-w-md w-full border-4 border-rose-200 shadow-2xl animate-in fade-in zoom-in-95">
              <h3 className="text-xl font-black text-rose-800 mb-2">Eliminar Usuario</h3>
              <p className="text-sm text-slate-500 font-medium mb-6">
                ¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede
                deshacer.
              </p>
              <div className="flex gap-3">
                <Button onClick={handleDelete} isLoading={isDeleting} variant="danger">
                  Eliminar
                </Button>
                <Button onClick={() => setDeleteUserId(null)} variant="secondary">
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
