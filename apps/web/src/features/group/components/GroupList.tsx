import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useGroupsStore } from '../stores/group.store';
import { GroupCard } from './GroupCard';
import { CreateGroupModal } from './CreateGroupModal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Input';
import type { Group } from '../services/group.api';

interface GroupWithCounts extends Group {
  _count?: { memberships: number; classAssignments: number };
}

export function GroupList() {
  const navigate = useNavigate();
  const { groups, loading, totalGroups, currentPage, fetchGroups, deleteGroup } = useGroupsStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const filteredGroups = searchTerm
    ? groups.filter((g) => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : groups;

  const handleDelete = async (groupId: string) => {
    if (
      !confirm(
        '¿Estás seguro de que quieres eliminar este grupo? Esta acción no se puede deshacer.',
      )
    ) {
      return;
    }
    setDeletingId(groupId);
    try {
      await deleteGroup(groupId);
    } finally {
      setDeletingId(null);
    }
  };

  const getGroupCounts = (group: Group) => {
    const withCounts = group as unknown as GroupWithCounts;
    return {
      memberCount: withCounts._count?.memberships ?? 0,
      classCount: withCounts._count?.classAssignments ?? 0,
    };
  };

  const totalPages = Math.ceil(totalGroups / 20);

  if (loading && groups.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" className="text-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <IconSearch
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={20}
          />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar grupos..."
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <IconPlus size={20} />
          <span className="ml-2">Nuevo Grupo</span>
        </Button>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-3xl border-4 border-slate-100">
          <p className="text-slate-500 font-medium">
            {searchTerm
              ? 'No se encontraron grupos con ese nombre'
              : 'Aún no tienes grupos creados'}
          </p>
          {!searchTerm ? (
            <Button variant="secondary" className="mt-4" onClick={() => setShowCreateModal(true)}>
              Crear tu primer grupo
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((group) => {
            const counts = getGroupCounts(group);
            return (
              <GroupCard
                key={group.id}
                group={group}
                memberCount={counts.memberCount}
                classCount={counts.classCount}
                onClick={() => navigate(`/groups/${group.id}`)}
                onDelete={() => handleDelete(group.id)}
                deleting={deletingId === group.id}
              />
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={page === currentPage ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => fetchGroups(page)}
            >
              {page}
            </Button>
          ))}
        </div>
      ) : null}

      <CreateGroupModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  );
}
