import { type BadgeInfo } from '@pixel-mentor/shared/gamification';

interface BadgeDetailModalProps {
  badge: BadgeInfo;
  onClose: () => void;
}

export const BadgeDetailModal = ({ badge, onClose }: BadgeDetailModalProps) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-lg max-w-sm w-full">
        <h2 className="text-xl font-bold mb-4">{badge.name}</h2>
        <p className="mb-4">{badge.description}</p>
        <button 
          className="bg-amber-500 text-white px-4 py-2 rounded"
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
