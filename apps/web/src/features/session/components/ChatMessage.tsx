import { IconRobotFace, IconUser } from '@tabler/icons-react';

import type { Message } from '@/features/session/hooks/useSessionLogic';

export function ChatMessage({ message }: { message: Message }) {
  const isStudent = message.role === 'student';

  return (
    <div
      className={`flex items-end gap-3 ${isStudent ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-4 duration-300`}
    >
      <div
        className={`w-10 h-10 shrink-0 rounded-[1rem] flex items-center justify-center border-4 shadow-sm ${isStudent ? 'bg-sky-200 border-sky-300 text-sky-700' : 'bg-amber-200 border-amber-300 text-amber-700'}`}
      >
        {isStudent ? (
          <IconUser className="w-6 h-6" stroke={2.5} />
        ) : (
          <IconRobotFace className="w-6 h-6" stroke={2.5} />
        )}
      </div>
      <div
        className={`max-w-[80%] p-4 text-sm sm:text-base font-bold leading-relaxed border-4 ${isStudent ? 'bg-sky-500 border-sky-600 text-white rounded-[2rem] rounded-br-md shadow-[0_4px_0_0_#0284c7]' : 'bg-white border-slate-200 text-slate-700 rounded-[2rem] rounded-bl-md shadow-[0_4px_0_0_#e2e8f0]'}`}
      >
        {message.text}
      </div>
    </div>
  );
}
