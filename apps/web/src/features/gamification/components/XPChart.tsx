import { IconStar } from '@tabler/icons-react';

interface XPChartProps {
  data: { date: string; xp: number }[];
}

export function XPChart({ data }: XPChartProps) {
  const maxXP = Math.max(...data.map((d) => d.xp), 100);

  return (
    <div className="w-full h-64 flex flex-col justify-end pt-8 relative">
      <div className="absolute top-0 left-0 right-0 flex justify-between items-center bg-amber-50 border-2 border-amber-200 px-4 py-2 rounded-2xl mb-8">
        <span className="text-xs font-black text-amber-700 uppercase tracking-wider">
          Récord Semanal
        </span>
        <span className="flex items-center gap-1 text-sm font-black text-amber-600">
          <IconStar className="w-4 h-4 fill-current" /> {maxXP} XP
        </span>
      </div>

      <div className="flex items-end justify-between h-full gap-2 sm:gap-4 mt-12">
        {data.map((d, i) => {
          const heightPercentage = Math.max((d.xp / maxXP) * 100, 8);
          const dateObj = new Date(d.date);
          const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'short' }).substring(0, 3);

          return (
            <div key={i} className="flex flex-col items-center gap-3 flex-1 group">
              <div className="relative w-full flex justify-center h-40 items-end">
                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs font-bold py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap z-10">
                  {d.xp} XP
                </div>

                <div className="w-full max-w-[40px] bg-slate-100 rounded-t-2xl border-x-4 border-t-4 border-slate-200 relative overflow-hidden h-full flex items-end">
                  <div
                    className="w-full bg-amber-400 border-t-4 border-amber-300 transition-all duration-1000 ease-out relative"
                    style={{ height: `${heightPercentage}%` }}
                  >
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-orange-500/20 to-transparent" />
                    <div className="absolute top-0 left-2 w-2 h-full bg-white/30 rounded-full" />
                  </div>
                </div>
              </div>

              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                {dayName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
