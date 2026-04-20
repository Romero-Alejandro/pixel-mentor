import { IconBook, IconChevronRight, IconTarget } from '@tabler/icons-react';
import { Card } from '@/components/ui/Card';
import type { StudentClass } from '../services/student-learning.api';

interface LearningPathCardProps {
  classItem: StudentClass;
  isLocked: boolean;
  onClick: () => void;
}

export function LearningPathCard({ classItem, isLocked, onClick }: LearningPathCardProps) {
  const statusColors = {
    DRAFT: 'bg-slate-100 text-slate-500',
    UNDER_REVIEW: 'bg-amber-100 text-amber-700',
    PUBLISHED: 'bg-emerald-100 text-emerald-700',
    ARCHIVED: 'bg-slate-200 text-slate-500',
  };

  return (
    <Card
      className={`transition-all duration-200 ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg cursor-pointer'}`}
      onClick={isLocked ? undefined : onClick}
    >
      <div className="p-4 flex items-center gap-4">
        <div
          className={`
          w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg
          ${isLocked ? 'bg-slate-100 text-slate-400' : 'bg-sky-100 text-sky-600'}
        `}
        >
          {isLocked ? '🔒' : classItem.order + 1}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className={`font-bold truncate ${isLocked ? 'text-slate-400' : 'text-slate-800'}`}>
            {classItem.classTitle}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${statusColors[classItem.status as keyof typeof statusColors] || statusColors.PUBLISHED}`}
            >
              {classItem.status === 'PUBLISHED' ? 'Disponible' : classItem.status}
            </span>
            <span className="text-xs text-slate-400">{classItem.groupName}</span>
          </div>
        </div>

        {isLocked ? (
          <IconTarget className="text-slate-300" size={24} />
        ) : (
          <IconChevronRight className="text-sky-400" size={24} />
        )}
      </div>
    </Card>
  );
}

interface GroupLearningCardProps {
  groupName: string;
  classes: StudentClass[];
  onClassClick: (classId: string) => void;
}

export function GroupLearningCard({ groupName, classes, onClassClick }: GroupLearningCardProps) {
  const sortedClasses = [...classes].sort((a, b) => a.order - b.order);

  return (
    <Card>
      <div className="p-4 border-b border-slate-100">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
          <IconBook className="text-sky-500" size={20} />
          {groupName}
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          {classes.length} clase{classes.length !== 1 ? 's' : ''} en tu camino de aprendizaje
        </p>
      </div>

      <div className="p-4 space-y-3">
        {sortedClasses.map((classItem) => (
          <LearningPathCard
            key={classItem.classId}
            classItem={classItem}
            isLocked={false}
            onClick={() => onClassClick(classItem.classId)}
          />
        ))}
      </div>
    </Card>
  );
}
