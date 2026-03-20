import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { useGamificationStore } from '../stores/gamification.store';
import { gamificationApi } from '../api/gamification.api';
import { 
  ProfileHero, 
  BadgeGrid, 
  StreakCalendar, 
  XPChart 
} from '../components/gamification/Achievements';
import { Card } from '../components/ui';

export function AchievementsPage() {
  const { profile, fetchProfile } = useGamificationStore();
  const [activeTab, setActiveTab] = useState<'badges' | 'progress' | 'streak'>('badges');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchProfile();
    const fetchData = async () => {
      const [badges, userBadges, streakHistory] = await Promise.all([
        gamificationApi.getBadges(),
        gamificationApi.getUserBadges(),
        gamificationApi.getStreakHistory(),
      ]);
      setData({ badges: badges.allBadges, userBadges: userBadges.earnedBadges, streakHistory });
    };
    fetchData();
  }, [fetchProfile]);

  if (!profile || !data) return <div>Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <Link to="/dashboard" className="flex items-center gap-2 mb-6 text-slate-600">
        <IconArrowLeft /> Volver al Tablero
      </Link>
      
      <ProfileHero />

      <div className="flex gap-4 mb-6">
        {(['badges', 'progress', 'streak'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg ${activeTab === tab ? 'bg-amber-500 text-white' : 'bg-white'}`}
          >
            {tab === 'badges' ? '🏅 Insignias' : tab === 'progress' ? '📊 Progreso' : '🔥 Rachas'}
          </button>
        ))}
      </div>

      <Card padding="lg">
        {activeTab === 'badges' && <BadgeGrid allBadges={data.badges} earnedBadges={data.userBadges} />}
        {activeTab === 'progress' && <XPChart data={data.streakHistory.slice(-7)} />}
        {activeTab === 'streak' && <StreakCalendar history={data.streakHistory.slice(-30)} />}
      </Card>
    </div>
  );
}
