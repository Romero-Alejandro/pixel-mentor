import { useClickerStore } from '@/stores/use-clicker-store';

const ClickerGame = () => {
  const { count, increment, reset, incrementBy } = useClickerStore();

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-gray-100 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800">Clicker Game</h2>
      <p className="text-4xl font-mono text-blue-600">{count}</p>
      <div className="flex gap-2">
        <button
          onClick={increment}
          className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
        >
          Click +1
        </button>
        <button
          onClick={() => incrementBy(10)}
          className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
        >
          Click +10
        </button>
        <button
          onClick={reset}
          className="px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default ClickerGame;
