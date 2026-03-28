import { IconEdit, IconTrash, IconBook, IconClock } from '@tabler/icons-react';
import type { Class, ClassStatus } from '@pixel-mentor/shared';

import { useAudio } from '@/contexts/AudioContext';
import { Card, Button } from '@/components/ui';

interface ClassCardProps {
  classItem: Class;
  onEdit: () => void;
  onDelete: () => void;
}

const STATUS_LABELS: Record<ClassStatus, string> = {
  DRAFT: 'Borrador',
  UNDER_REVIEW: 'En revisión',
  PUBLISHED: 'Publicada',
  ARCHIVED: 'Archivada',
};

const STATUS_COLORS: Record<ClassStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700 border-amber-300',
  PUBLISHED: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  ARCHIVED: 'bg-rose-100 text-rose-700 border-rose-300',
};

export function ClassCard({ classItem, onEdit, onDelete }: ClassCardProps) {
  const { playClick, playFocus } = useAudio();

  const handleEdit = () => {
    playClick();
    onEdit();
  };

  const handleDelete = () => {
    playFocus();
    onDelete();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Sin fecha';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const lessonCount = classItem.lessons?.length ?? 0;
  const totalDuration =
    classItem.lessons?.reduce((acc, lesson) => acc + (lesson.duration ?? 0), 0) ?? 0;

  return (
    <Card variant="mission" className="relative group">
      {/* Status badge */}
      <div className="absolute top-4 right-4">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border-2 ${STATUS_COLORS[classItem.status]}`}
        >
          {STATUS_LABELS[classItem.status]}
        </span>
      </div>

      {/* Class info */}
      <div className="pr-24">
        <h3 className="text-xl font-black text-slate-800 mb-2 line-clamp-2">{classItem.title}</h3>
        {classItem.description ? (
          <p className="text-slate-500 font-medium text-sm line-clamp-2 mb-4">
            {classItem.description}
          </p>
        ) : null}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
        <span className="flex items-center gap-1.5">
          <IconBook className="w-4 h-4" />
          {lessonCount} lección{lessonCount !== 1 ? 'es' : ''}
        </span>
        {totalDuration > 0 ? (
          <span className="flex items-center gap-1.5">
            <IconClock className="w-4 h-4" />
            {Math.round(totalDuration / 60)}h {totalDuration % 60}m
          </span>
        ) : null}
        <span className="text-slate-400">{formatDate(classItem.createdAt)}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-100">
        <Button onClick={handleEdit} variant="secondary" size="sm" className="flex-1">
          <IconEdit className="w-4 h-4 mr-1.5" />
          Editar
        </Button>
        <Button
          onClick={handleDelete}
          variant="danger"
          size="sm"
          disabled={classItem.status !== 'DRAFT'}
          title={
            classItem.status !== 'DRAFT'
              ? 'Solo se pueden eliminar clases en estado borrador'
              : undefined
          }
        >
          <IconTrash className="w-4 h-4" />
        </Button>
      </div>

      {/* Hover overlay effect */}
      <div className="absolute inset-0 bg-sky-50/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem] pointer-events-none" />
    </Card>
  );
}
