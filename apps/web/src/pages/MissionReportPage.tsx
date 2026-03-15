import { Link, useLocation } from 'react-router-dom';
import {
  IconTrophy,
  IconStar,
  IconTargetArrow,
  IconArrowLeft,
  IconBooks,
} from '@tabler/icons-react';

import { Button, Card, Badge } from '../components/ui';

interface MissionStats {
  xpEarned: number;
  accuracy: number;
  conceptsMastered: string[];
}

export function MissionReportPage() {
  const location = useLocation();
  const stats: MissionStats = location.state?.stats || {
    xpEarned: 150,
    accuracy: 95,
    conceptsMastered: ['Variables', 'Ciclos', 'Lógica Condicional'],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full shadow-lg shadow-orange-200 mb-4 animate-bounce">
            <IconTrophy className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800">¡Misión Completada!</h1>
          <p className="text-slate-500 mt-2">Has terminado la clase exitosamente</p>
        </div>

        <Card variant="elevated" padding="lg" className="shadow-xl shadow-slate-200/50">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-5 bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <IconStar className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                  XP Ganada
                </span>
              </div>
              <span className="text-3xl font-bold text-amber-700">+{stats.xpEarned}</span>
            </div>
            <div className="p-5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <IconTargetArrow className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                  Precisión
                </span>
              </div>
              <span className="text-3xl font-bold text-emerald-700">{stats.accuracy}%</span>
            </div>
          </div>

          {/* Concepts */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
              <IconBooks className="w-4 h-4" />
              Conceptos Dominados
            </h3>
            <div className="flex flex-wrap gap-2">
              {stats.conceptsMastered.map((concept, index) => (
                <Badge key={index} variant="success" className="text-sm px-3 py-1">
                  ✓ {concept}
                </Badge>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <Link to="/dashboard">
            <Button className="w-full" size="lg">
              <IconArrowLeft className="w-5 h-5 mr-2" />
              Volver al Inicio
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
