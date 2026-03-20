interface StreakCalendarProps {
  history: { date: string; active: boolean }[];
}

export const StreakCalendar = ({ history }: StreakCalendarProps) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div className="grid grid-cols-7 gap-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="text-center font-bold text-gray-400">{day}</div>
        ))}
        {history.map((day) => (
          <div
            key={day.date}
            title={day.date}
            className={`h-12 w-12 rounded flex items-center justify-center ${day.active ? 'bg-amber-500 text-white' : 'bg-gray-100'}`}
          >
            {new Date(day.date).getDate()}
          </div>
        ))}
      </div>
    </div>
  );
};
