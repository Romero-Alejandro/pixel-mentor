interface XPChartProps {
  data: { date: string; xp: number }[];
}

export const XPChart = ({ data }: XPChartProps) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-end justify-between h-48">
      {data.map((d) => (
        <div key={d.date} className="flex flex-col items-center gap-2">
          <div 
            className="w-12 bg-amber-500 rounded-t"
            style={{ height: `${(d.xp / 100) * 100}%` }}
          />
          <p className="text-xs">{new Date(d.date).toLocaleDateString('es-ES', { weekday: 'short' })}</p>
        </div>
      ))}
    </div>
  );
};
