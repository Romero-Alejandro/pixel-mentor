import { IconStarFilled } from '@tabler/icons-react';
import { LoginForm } from '@/features/auth/components/LoginForm';

export function LoginPage() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-sky-50 p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute top-10 left-10 w-48 h-48 bg-sky-200 rounded-full blur-[60px] opacity-60 animate-float pointer-events-none" />
      <div
        className="absolute bottom-10 right-10 w-56 h-56 bg-amber-200 rounded-full blur-[60px] opacity-60 animate-float pointer-events-none"
        style={{ animationDelay: '1.5s' }}
      />

      <IconStarFilled className="absolute top-1/4 left-1/4 w-6 h-6 text-amber-200 animate-ping pointer-events-none opacity-60" />
      <IconStarFilled className="absolute bottom-1/4 right-1/4 w-8 h-8 text-sky-200 animate-pulse pointer-events-none opacity-60" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <LoginForm />
      </div>
    </div>
  );
}
