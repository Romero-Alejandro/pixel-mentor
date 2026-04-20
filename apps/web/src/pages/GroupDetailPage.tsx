import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconUsers, IconBook, IconPlus, IconTrash } from '@tabler/icons-react';
import { useGroupsStore } from '@/features/group/stores/group.store';
import { userApi } from '@/features/group/services/group.api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/services/api';
import type { Class } from '@pixel-mentor/shared';

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const {
    currentGroup,
    members,
    classes,
    loading,
    error,
    fetchGroup,
    fetchMembers,
    fetchClasses,
    addMembers,
    removeMember,
    assignClass,
    unassignClass,
    clearCurrentGroup,
  } = useGroupsStore();

  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showAssignClassModal, setShowAssignClassModal] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  useEffect(() => {
    if (groupId) {
      fetchGroup(groupId);
      fetchMembers(groupId);
      fetchClasses(groupId);
    }
    return () => {
      clearCurrentGroup();
    };
  }, [groupId, fetchGroup, fetchMembers, fetchClasses, clearCurrentGroup]);

  useEffect(() => {
    if (showAssignClassModal) {
      setLoadingClasses(true);
      api
        .getMyClasses()
        .then(setAvailableClasses)
        .catch(console.error)
        .finally(() => setLoadingClasses(false));
    }
  }, [showAssignClassModal]);

  const handleAddMember = async () => {
    if (!groupId || !studentEmail.trim()) return;
    setActionLoading(true);
    try {
      const { uuid } = await userApi.resolveEmailToUuid(studentEmail.trim());
      await addMembers(groupId, [uuid]);
      setStudentEmail('');
      setShowAddMembersModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (studentId: string) => {
    if (!groupId || !confirm('¿Eliminar este miembro del grupo?')) return;
    setActionLoading(true);
    try {
      await removeMember(groupId, studentId);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignClass = async () => {
    if (!groupId || !selectedClassId) return;
    setActionLoading(true);
    try {
      await assignClass(groupId, selectedClassId, classes.length);
      setSelectedClassId('');
      setShowAssignClassModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnassignClass = async (classId: string) => {
    if (!groupId || !confirm('¿Eliminar esta clase del grupo?')) return;
    setActionLoading(true);
    try {
      await unassignClass(groupId, classId);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const sortedClasses = [...classes].sort((a, b) => a.order - b.order);

  if (loading && !currentGroup) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" className="text-sky-500" />
      </div>
    );
  }

  if (error || !currentGroup) {
    return (
      <div className="p-6 bg-rose-50 border-4 border-rose-100 rounded-2xl text-rose-600">
        Error al cargar el grupo: {error || 'Grupo no encontrado'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/groups')}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <IconArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-800">{currentGroup.name}</h1>
          {currentGroup.description ? (
            <p className="text-slate-500">{currentGroup.description}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <IconUsers className="text-sky-500" size={20} />
              Miembros ({members.length})
            </h2>
            <Button size="sm" onClick={() => setShowAddMembersModal(true)}>
              <IconPlus size={16} />
              <span className="ml-1">Añadir</span>
            </Button>
          </div>
          <div className="p-4">
            {members.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">
                No hay miembros en este grupo
              </p>
            ) : (
              <ul className="space-y-2">
                {members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                  >
                    <div>
                      <p className="font-medium text-slate-700">
                        {member.user?.name || member.studentId}
                      </p>
                      <p className="text-xs text-slate-400">{member.user?.email || 'Usuario'}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(member.studentId)}
                      disabled={actionLoading}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Eliminar miembro"
                    >
                      <IconTrash size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <IconBook className="text-sky-500" size={20} />
              Clases ({classes.length})
            </h2>
            <Button size="sm" onClick={() => setShowAssignClassModal(true)}>
              <IconPlus size={16} />
              <span className="ml-1">Asignar</span>
            </Button>
          </div>
          <div className="p-4">
            {sortedClasses.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">
                No hay clases asignadas a este grupo
              </p>
            ) : (
              <ul className="space-y-2">
                {sortedClasses.map((groupClass, index) => (
                  <li
                    key={groupClass.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                  >
                    <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-700">
                        {groupClass.class?.title || groupClass.classId}
                      </p>
                      <p className="text-xs text-slate-400">
                        {groupClass.class?.status || 'Sin estado'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleUnassignClass(groupClass.classId)}
                      disabled={actionLoading}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Eliminar clase del grupo"
                    >
                      <IconTrash size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Modal
        isOpen={showAddMembersModal}
        onClose={() => setShowAddMembersModal(false)}
        title="Añadir Miembro"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email del estudiante
            </label>
            <Input
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="estudiante@ejemplo.com"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowAddMembersModal(false)}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button onClick={handleAddMember} disabled={actionLoading || !studentEmail.trim()}>
              {actionLoading ? 'Añadiendo...' : 'Añadir'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAssignClassModal}
        onClose={() => setShowAssignClassModal(false)}
        title="Asignar Clase"
        size="sm"
      >
        <div className="space-y-4">
          {loadingClasses ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" className="text-sky-500" />
            </div>
          ) : availableClasses.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              No tienes clases disponibles. Crea una clase primero.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-500">Selecciona una clase para añadir al grupo:</p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {availableClasses.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                      selectedClassId === cls.id
                        ? 'border-sky-400 bg-sky-50'
                        : 'border-slate-200 hover:border-sky-200'
                    }`}
                  >
                    <p className="font-medium text-slate-700">{cls.title}</p>
                    <p className="text-xs text-slate-400">{cls.status}</p>
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowAssignClassModal(false)}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button onClick={handleAssignClass} disabled={actionLoading || !selectedClassId.trim()}>
              {actionLoading ? 'Asignando...' : 'Asignar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
