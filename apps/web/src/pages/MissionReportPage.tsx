import { Link, useLocation } from 'react-router-dom';
import { IconTrophy, IconStar, IconArrowLeft, IconBooks } from '@tabler/icons-react';
import { Button, Card, Badge } from '../components/ui';
import { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';

interface ReportData {
  xpEarned: number;
  totalXP: number;
  currentLevel: number;
  levelTitle: string;
  newBadges: Array<{ code: string; name: string; icon: string; xpReward?: number }>;
  conceptsMastered: string[];
}

const FALLBACK_XP = 150;
const FALLBACK_CONCEPTS = ['Variables', 'Ciclos', 'Lógica Condicional'];

const Confetti = () => {
  const particles = useMemo(
    () =>
      Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: ['#fbbf24', '#f59e0b', '#ec4899', '#3b82f6'][
              Math.floor(Math.random() * 4)
            ],
            animation: `confetti-fall 3s linear forwards`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      )),
    [],
  );
  return <div className="fixed inset-0 pointer-events-none overflow-hidden">{particles}</div>;
};

export function MissionReportPage() {
  const location = useLocation();
  const { report: initialReport, sessionId } = location.state || {};
  const [report, setReport] = useState<ReportData | undefined>(initialReport);
  const [isLoading, setIsLoading] = useState(!initialReport && !!sessionId);
  const [displayXP, setDisplayXP] = useState(0);
  const [showConfetti, setShowConfetti] = useState(true);
  const [showContinue, setShowContinue] = useState(false);

  useEffect(() => {
    if (!initialReport && sessionId) {
      const fetchReport = async () => {
        try {
          const data = await api.getMissionReport(sessionId);
          setReport(data as ReportData);
        } catch (e) {
          console.warn('Failed to fetch mission report:', e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchReport();
    }
  }, [initialReport, sessionId]);

  useEffect(() => {
    if (!report) return;

    setTimeout(() => setShowConfetti(false), 3000);

    setTimeout(() => {
      const duration = 1500;
      const start = Date.now();
      const interval = setInterval(() => {
        const now = Date.now();
        const progress = Math.min((now - start) / duration, 1);
        setDisplayXP(Math.floor(progress * report.xpEarned));
        if (progress === 1) clearInterval(interval);
      }, 16);
    }, 500);

    setTimeout(() => setShowContinue(true), 2500);
  }, [report]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-amber-200 border-t-amber-500 rounded-full mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Cargando reporte...</p>
        </div>
      </div>
    );
  }

  const conceptsMastered = report?.conceptsMastered ?? FALLBACK_CONCEPTS;
  const currentLevel = report?.currentLevel;
  const levelTitle = report?.levelTitle;
  const newBadges = report?.newBadges ?? [];
  const totalXP = report?.totalXP;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-6 relative">
      {showConfetti && <Confetti />}

      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full shadow-lg shadow-orange-200 mb-4 animate-bounce">
            <IconTrophy className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800">¡Misión Completada!</h1>
          <p className="text-slate-500 mt-2">Has terminado la clase exitosamente</p>
        </div>

        <Card variant="elevated" padding="lg" className="shadow-xl shadow-slate-200/50">
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-5 bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <IconStar className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                  XP Ganada
                </span>
              </div>
              <span className="text-3xl font-bold text-amber-700">+{displayXP}</span>
              {totalXP != null && (
                <p className="text-xs text-amber-500 mt-1">Total: {totalXP} XP</p>
              )}
            </div>
            <div className="p-5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <IconStar className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                  Precisión
                </span>
              </div>
              <span className="text-3xl font-bold text-emerald-700">100%</span>
            </div>
          </div>

          {currentLevel != null && (
            <div className="mb-6 p-4 bg-gradient-to-br from-violet-50 to-violet-100/50 border border-violet-200 rounded-xl text-center">
              <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">
                Nivel Actual
              </span>
              <p className="text-2xl font-bold text-violet-700 mt-1">
                Nivel {currentLevel}
                {levelTitle ? ` — ${levelTitle}` : ''}
              </p>
            </div>
          )}

          {newBadges.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                <IconTrophy className="w-4 h-4" /> Nuevos Insignias
              </h3>
              <div className="flex flex-wrap gap-2">
                {newBadges.map((badge, idx) => (
                  <Badge
                    key={badge.code}
                    variant="success"
                    className="text-sm px-3 py-1 animate-bounce-in"
                    style={{ animationDelay: `${idx * 200}ms`, animationFillMode: 'both' }}
                  >
                    {badge.icon} {badge.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
              <IconBooks className="w-4 h-4" /> Conceptos Dominados
            </h3>
            <div className="flex flex-wrap gap-2">
              {conceptsMastered.map((concept, index) => (
                <Badge key={index} variant="success" className="text-sm px-3 py-1">
                  ✓ {concept}
                </Badge>
              ))}
            </div>
          </div>

          <div style={{ opacity: showContinue ? 1 : 0, transition: 'opacity 0.5s' }}>
            <Link to="/dashboard">
              <Button className="w-full" size="lg">
                <IconArrowLeft className="w-5 h-5 mr-2" />
                Volver al Inicio
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
