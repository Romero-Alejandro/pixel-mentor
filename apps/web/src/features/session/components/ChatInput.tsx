import { IconSend, IconPlayerPause } from '@tabler/icons-react';

import { Spinner } from '@/components/ui';

interface ChatInputProps {
  inputText: string;
  setInputText: (val: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  isProcessing: boolean;
  isSpeaking: boolean;
  stopSpeaking: () => void;
  sessionCompleted: boolean;
}

export function ChatInput({
  inputText,
  setInputText,
  onSend,
  onKeyPress,
  isProcessing,
  isSpeaking,
  stopSpeaking,
  sessionCompleted,
}: ChatInputProps) {
  return (
    <div className="flex gap-3 items-end p-4 bg-white border-t-4 border-slate-100 rounded-b-[2rem]">
      <button
        onClick={() => (isSpeaking ? stopSpeaking() : null)}
        disabled={!isSpeaking}
        className="shrink-0 w-14 h-14 flex items-center justify-center rounded-[1.5rem] border-4 border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:border-slate-300 hover:-translate-y-1 active:translate-y-1 active:shadow-none shadow-[0_4px_0_0_#e2e8f0] disabled:opacity-40 disabled:hover:translate-y-0 disabled:shadow-none transition-all outline-none"
      >
        <IconPlayerPause
          className={`w-7 h-7 ${isSpeaking ? 'text-rose-500 fill-rose-500 animate-pulse' : 'text-slate-300'}`}
        />
      </button>

      <div className="flex-1 relative flex items-center bg-sky-50 border-4 border-sky-200 rounded-[1.5rem] p-1.5 shadow-inner focus-within:border-sky-400 focus-within:bg-white transition-all">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={onKeyPress}
          placeholder="Escribe tu respuesta aquí..."
          disabled={isProcessing || sessionCompleted}
          className="w-full h-12 pl-4 pr-14 bg-transparent text-slate-800 font-bold placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={onSend}
          disabled={!inputText.trim() || isProcessing || sessionCompleted}
          className="absolute right-2 shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-sky-500 text-white border-b-4 border-sky-600 shadow-sm hover:bg-sky-400 active:translate-y-1 active:border-b-0 disabled:opacity-50 disabled:active:translate-y-0 transition-all outline-none"
        >
          {isProcessing ? (
            <Spinner size="sm" className="text-white" />
          ) : (
            <IconSend className="w-5 h-5" stroke={3} />
          )}
        </button>
      </div>
    </div>
  );
}
