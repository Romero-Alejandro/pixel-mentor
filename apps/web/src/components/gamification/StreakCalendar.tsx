import { IconFlame, IconMinus } from '@tabler/icons-react';

interface StreakCalendarProps {
  history: { date: string; active: boolean }[];
}

export function StreakCalendar({ history }: StreakCalendarProps) {
  const daysOfWeek = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-2 mb-3">
        {daysOfWeek.map((day, i) => (
          <div key={i} className="text-center text-xs font-black text-slate-400 uppercase">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {history.map((day, idx) => {
          const dateObj = new Date(day.date);
          const dayNumber = dateObj.getDate();

          return (
            <div
              key={idx}
              title={day.date}
              className={`
                relative flex flex-col items-center justify-center aspect-square rounded-2xl border-4 transition-transform
                ${
                  day.active
                    ? 'bg-orange-50 border-orange-400 shadow-[0_4px_0_0_#fb923c] scale-105 z-10'
                    : 'bg-slate-50 border-slate-200 border-dashed'
                }
              `}
            >
              <span
                className={`text-[10px] font-bold absolute top-1 ${day.active ? 'text-orange-700' : 'text-slate-400'}`}
              >
                {dayNumber}
              </span>

              <div className="mt-2">
                {day.active ? (
                  <IconFlame
                    className="w-6 h-6 text-orange-500 fill-current animate-pulse"
                    stroke={2}
                  />
                ) : (
                  <IconMinus className="w-5 h-5 text-slate-300" stroke={3} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
