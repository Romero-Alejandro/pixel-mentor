import { IconUsers, IconChevronRight, IconTrash, IconEdit } from '@tabler/icons-react';
import { Card } from '@/components/ui/Card';
import type { Group } from '../services/group.api';

interface GroupCardProps {
  group: Group;
  memberCount?: number;
  classCount?: number;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}

export function GroupCard({
  group,
  memberCount = 0,
  classCount = 0,
  onClick,
  onEdit,
  onDelete,
  deleting,
}: GroupCardProps) {
  const formattedDate = new Date(group.createdAt).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Card className="hover:shadow-lg transition-all duration-200 group">
      <div className="p-6 cursor-pointer" onClick={onClick}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-800 group-hover:text-sky-600 transition-colors">
              {group.name}
            </h3>
            {group.description ? (
              <p className="mt-2 text-sm text-slate-500 line-clamp-2">{group.description}</p>
            ) : null}
          </div>
          <IconChevronRight
            className="text-slate-400 group-hover:text-sky-500 transition-colors"
            size={24}
          />
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <IconUsers size={16} />
            <span>{memberCount} miembros</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>📚 {classCount} clases</span>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-400">Creado el {formattedDate}</p>
      </div>

      {onEdit || onDelete ? (
        <div className="flex gap-2 px-6 pb-4 border-t border-slate-100 pt-4 mt-2">
          {onEdit ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-slate-500 hover:text-sky-600 rounded-xl hover:bg-sky-50 transition-colors"
            >
              <IconEdit size={16} />
              <span>Editar</span>
            </button>
          ) : null}
          {onDelete ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={deleting}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-slate-500 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors ml-auto disabled:opacity-50"
            >
              <IconTrash size={16} />
              <span>{deleting ? 'Eliminando...' : 'Eliminar'}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
