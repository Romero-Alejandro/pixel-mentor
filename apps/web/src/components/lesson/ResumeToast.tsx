import { useEffect } from 'react';

interface ResumeToastProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export function ResumeToast({ isVisible, onDismiss }: ResumeToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onDismiss]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-amber-100 border-2 border-amber-300 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
      <span className="text-amber-800 font-medium">🔄 Continuando tu sesión anterior...</span>
    </div>
  );
}
