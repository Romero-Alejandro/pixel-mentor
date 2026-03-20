import { useGamificationStore } from '../../../stores/gamification.store';

export const ProfileHero = () => {
  const { profile } = useGamificationStore();
  if (!profile) return null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6">
      <h2 className="text-xl font-semibold mb-2">Perfil de Aventurero</h2>
      <div className="flex items-center gap-4">
        <div className="text-4xl">🌸</div>
        <div>
          <p className="font-bold">Nombre del Usuario</p>
          <p>Nivel {profile.currentLevel}: {profile.levelTitle}</p>
        </div>
        <div className="flex gap-4 ml-auto">
          <span>🔥{profile.currentStreak}</span>
          <span>🎖️{profile.badges?.length || 0}</span>
        </div>
      </div>
      <div className="mt-4">
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-amber-500"
            style={{ width: `${(profile.totalXP % 250) / 250 * 100}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 mt-1">{profile.totalXP % 250}/250 XP</p>
      </div>
    </div>
  );
};
