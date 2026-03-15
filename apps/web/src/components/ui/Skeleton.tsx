import { cn } from '@/utils/cn';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, variant = 'rectangular', width, height }: SkeletonProps) {
  const variants = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      className={cn('animate-pulse bg-slate-200', variants[variant], className)}
      style={{
        width: width,
        height: height,
      }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="h-6 w-2/3" />
        <Skeleton variant="text" className="h-4 w-16" />
      </div>
      <Skeleton variant="text" className="h-4 w-full" />
      <Skeleton variant="text" className="h-4 w-3/4" />
      <div className="flex items-center gap-2 pt-2">
        <Skeleton variant="circular" className="w-5 h-5" />
        <Skeleton variant="text" className="h-4 w-24" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ columns = 3 }: { columns?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton variant="text" className="h-4 w-24" />
        </td>
      ))}
    </tr>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton variant="text" className="h-4 w-16 mb-1.5" />
        <Skeleton className="h-12 w-full" />
      </div>
      <div>
        <Skeleton variant="text" className="h-4 w-16 mb-1.5" />
        <Skeleton className="h-12 w-full" />
      </div>
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
