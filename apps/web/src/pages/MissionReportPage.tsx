import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  IconTrophy,
  IconStar,
  IconMap,
  IconBooks,
  IconTargetArrow,
  IconChevronRight,
  IconSparkles,
} from '@tabler/icons-react';

import { api } from '@/services/api';
import { Button, Card, Spinner } from '@/components/ui';
import { useAnimatedNumber } from '@/features/dashboard/hooks/useAnimatedNumber';

interface ReportData {
  xpEarned: number;
  totalXP: number;
  currentLevel: number;
  levelTitle: string;
  newBadges: Array<{ code: string; name: string; icon: string; xpReward?: number }>;
  conceptsMastered: string[];
}

const FALLBACK_CONCEPTS = ['Variables', 'Ciclos', 'Lógica Condicional'];

function Confetti() {
  const particles = Array.from({ length: 50 }).map((_, i) => {
    const colors = ['#fbbf24', '#f59e0b', '#ec4899', '#3b82f6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    return (
      <div
        key={i}
        className="absolute w-3 h-3 rounded-full"
        style={{
          left: `${Math.random() * 100}%`,
          backgroundColor: randomColor,
          animation: `confetti-fall ${2 + Math.random() * 2}s linear forwards`,
          animationDelay: `${Math.random()}s`,
        }}
      />
    );
  });
  return <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">{particles}</div>;
}

export function MissionReportPage() {
  const location = useLocation();
  const { report: initialReport, sessionId } = location.state || {};

  const [report, setReport] = useState<ReportData | undefined>(initialReport);
  const [isLoading, setIsLoading] = useState(!initialReport && !!sessionId);
  const [showConfetti, setShowConfetti] = useState(true);
  const [showContinue, setShowContinue] = useState(false);

  const displayXP = useAnimatedNumber(report?.xpEarned || 0, 1500, 500);

  useEffect(() => {
    if (!initialReport && sessionId) {
      api
        .getMissionReport(sessionId)
        .then((data) => setReport(data as ReportData))
        .finally(() => setIsLoading(false));
    }
  }, [initialReport, sessionId]);

  useEffect(() => {
    if (!report) return;
    const confettiTimer = setTimeout(() => setShowConfetti(false), 4000);
    const continueTimer = setTimeout(() => setShowContinue(true), 2500);

    return () => {
      clearTimeout(confettiTimer);
      clearTimeout(continueTimer);
    };
  }, [report]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f0f9ff] flex items-center justify-center p-6">
        <div className="text-center flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-sky-200 rounded-full flex items-center justify-center shadow-[0_6px_0_0_#bae6fd]">
            <Spinner size="lg" className="text-sky-500" />
          </div>
          <p className="text-sky-800 font-black text-lg animate-pulse uppercase tracking-wider">
            Recopilando logros...
          </p>
        </div>
      </div>
    );
  }

  const conceptsMastered = report?.conceptsMastered ?? FALLBACK_CONCEPTS;

  return (
    <div className="min-h-screen bg-[#f0f9ff] flex items-center justify-center p-6 relative overflow-hidden">
      {showConfetti ? <Confetti /> : null}

      <div className="absolute top-0 left-0 w-64 h-64 bg-amber-200 rounded-full blur-3xl opacity-50 -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-200 rounded-full blur-3xl opacity-50 translate-x-1/2 translate-y-1/2" />

      <div className="w-full max-w-lg relative z-10 animate-bounce-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-28 h-28 bg-amber-400 rounded-full shadow-[0_12px_0_0_#d97706] border-4 border-white mb-4 relative rotate-3 animate-float">
            <IconTrophy className="w-14 h-14 text-white drop-shadow-md" stroke={2.5} />
            <IconSparkles className="absolute -top-2 -right-2 w-10 h-10 text-amber-200 animate-pulse" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-sky-900 tracking-tight">
            ¡Misión Completada!
          </h1>
          <p className="text-sky-700 font-bold mt-2 text-lg">Has superado este desafío con éxito</p>
        </div>

        <Card
          variant="mission"
          className="bg-white/95 backdrop-blur-sm border-4 border-amber-300 shadow-[0_8px_0_0_#fcd34d]"
        >
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-amber-50 border-4 border-amber-200 rounded-2xl flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-1.5 mb-1">
                <IconStar className="w-5 h-5 text-amber-500 fill-current" />
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                  XP Ganada
                </span>
              </div>
              <span className="text-4xl font-black text-amber-600">+{displayXP}</span>
              {report?.totalXP != null ? (
                <p className="text-xs font-bold text-amber-500 mt-1">Total: {report.totalXP} XP</p>
              ) : null}
            </div>

            <div className="p-4 bg-emerald-50 border-4 border-emerald-200 rounded-2xl flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-1.5 mb-1">
                <IconTargetArrow className="w-5 h-5 text-emerald-500" />
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  Precisión
                </span>
              </div>
              <span className="text-4xl font-black text-emerald-600">100%</span>
            </div>
          </div>

          {report?.currentLevel != null ? (
            <div className="mb-6 p-4 bg-purple-50 border-4 border-purple-200 rounded-[1.5rem] flex items-center justify-between shadow-inner">
              <div>
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block">
                  Nivel Actual
                </span>
                <span className="text-xl font-black text-purple-800">
                  {report.levelTitle || `Nivel ${report.currentLevel}`}
                </span>
              </div>
              <div className="w-14 h-14 bg-purple-200 rounded-full flex items-center justify-center border-4 border-purple-300 shadow-sm">
                <span className="text-2xl font-black text-purple-700">{report.currentLevel}</span>
              </div>
            </div>
          ) : null}

          {report?.newBadges && report.newBadges.length > 0 ? (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-sky-800 mb-3 flex items-center gap-2 uppercase tracking-wider">
                <IconTrophy className="w-4 h-4" /> Nuevas Insignias
              </h3>
              <div className="flex flex-wrap gap-2">
                {report.newBadges.map((badge, idx) => (
                  <div
                    key={badge.code}
                    className="flex items-center gap-2 bg-amber-100 border-2 border-amber-300 text-amber-900 px-3 py-1.5 rounded-full font-bold text-sm animate-bounce-in shadow-sm"
                    style={{ animationDelay: `${idx * 200}ms` }}
                  >
                    <IconStar className="w-4 h-4 fill-amber-500 text-amber-500" />
                    <span>{badge.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mb-8">
            <h3 className="text-sm font-bold text-sky-800 mb-3 flex items-center gap-2 uppercase tracking-wider">
              <IconBooks className="w-4 h-4" /> Conceptos Dominados
            </h3>
            <div className="flex flex-wrap gap-2">
              {conceptsMastered.map((concept) => (
                <div
                  key={concept}
                  className="bg-emerald-100 border-2 border-emerald-300 text-emerald-800 px-3 py-1.5 rounded-full font-bold text-sm shadow-sm flex items-center gap-1.5"
                >
                  <IconChevronRight className="w-4 h-4 text-emerald-500" stroke={3} /> {concept}
                </div>
              ))}
            </div>
          </div>

          <div
            className={`transition-all duration-500 ${showContinue ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
          >
            <Link to="/dashboard" className="block w-full outline-none">
              <Button
                size="lg"
                className="w-full text-xl py-4 bg-sky-500 border-4 border-sky-600 shadow-[0_6px_0_0_#0284c7] hover:bg-sky-400 hover:shadow-[0_8px_0_0_#0284c7] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all text-white font-black"
              >
                <IconMap className="w-6 h-6 mr-2" stroke={3} /> Volver al Mapa
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
