import { Link, useLocation } from 'react-router-dom';

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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="p-8 border-b border-slate-100 bg-slate-900 text-white">
            <div className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
              Reporte de Telemetría
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Misión Concluida</h1>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-5 border border-slate-200 rounded-md flex flex-col items-start bg-slate-50">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                  XP Obtenida
                </span>
                <span className="text-2xl font-mono font-medium">{stats.xpEarned}</span>
              </div>
              <div className="p-5 border border-slate-200 rounded-md flex flex-col items-start bg-emerald-50/30">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                  Precisión
                </span>
                <span className="text-2xl font-mono font-medium text-emerald-700">
                  {stats.accuracy}%
                </span>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-4">
                Módulos Dominados
              </h3>
              <div className="flex flex-col gap-2">
                {stats.conceptsMastered.map((concept, index) => (
                  <div
                    key={index}
                    className="flex items-center px-3 py-2 text-sm border border-slate-200 bg-white rounded-md"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-3"></div>
                    {concept}
                  </div>
                ))}
              </div>
            </div>

            <Link
              to="/dashboard"
              className="w-full flex items-center justify-center py-2.5 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors"
            >
              Retornar al Terminal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
