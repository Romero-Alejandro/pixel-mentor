import { useState } from 'react';
import { BadgeDetailModal } from './BadgeDetailModal';
import { type EarnedBadge, type BadgeInfo } from '@pixel-mentor/shared/gamification';

interface BadgeGridProps {
  allBadges: BadgeInfo[];
  earnedBadges: EarnedBadge[];
}

export const BadgeGrid = ({ allBadges, earnedBadges }: BadgeGridProps) => {
  const [selectedBadge, setSelectedBadge] = useState<BadgeInfo | null>(null);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {allBadges.map((badge) => {
        const isEarned = earnedBadges.some((b) => b.badgeId === badge.id);
        return (
          <div 
            key={badge.id}
            className={`p-4 rounded-lg border cursor-pointer ${isEarned ? 'bg-white border-amber-200' : 'bg-gray-100 border-gray-200'}`}
            onClick={() => setSelectedBadge(badge)}
          >
            <div className={`text-4xl ${!isEarned && 'grayscale'}`}>
                {isEarned ? '🎖️' : '🔒'}
            </div>
            <h3 className="font-semibold">{badge.name}</h3>
            {isEarned && <p className="text-sm text-green-600">✓</p>}
            {!isEarned && <p className="text-sm text-gray-500">Progreso: {badge.requirement}</p>}
          </div>
        );
      })}
      {selectedBadge && (
        <BadgeDetailModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
      )}
    </div>
  );
};
