import { LoginForm } from '@/features/auth/components/LoginForm';

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f9ff] p-6 relative overflow-hidden">
      <div className="absolute top-10 left-10 w-32 h-32 bg-sky-200 rounded-full blur-3xl opacity-60 animate-float" />
      <div
        className="absolute bottom-10 right-10 w-40 h-40 bg-amber-200 rounded-full blur-3xl opacity-60 animate-float"
        style={{ animationDelay: '1s' }}
      />
      <div className="w-full max-w-sm relative z-10 animate-bounce-in">
        <LoginForm />
      </div>
    </div>
  );
}
