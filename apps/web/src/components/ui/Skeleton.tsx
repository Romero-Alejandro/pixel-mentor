import { cn } from '@/utils/cn';

// ─── Base Skeleton with Shimmer Animation ────────────────────────────────────

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  /** @default false */
  shimmer?: boolean;
}

export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  shimmer = false,
}: SkeletonProps) {
  const variants = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        'bg-slate-200',
        variants[variant],
        shimmer && 'skeleton-shimmer',
        !shimmer && 'animate-pulse',
        className,
      )}
      style={{
        width: width,
        height: height,
      }}
    />
  );
}

// ─── Lesson Skeletons ────────────────────────────────────────────────────────

interface LessonSkeletonProps {
  className?: string;
}

export function SkeletonLesson({ className }: LessonSkeletonProps) {
  return (
    <div
      aria-label="Cargando lección"
      aria-busy="true"
      className={cn('flex flex-col items-center justify-center p-8 gap-6', className)}
    >
      {/* Mascot placeholder */}
      <div className="w-44 h-44 rounded-full bg-slate-200 skeleton-shimmer" />

      {/* Content card */}
      <div className="w-full max-w-lg bg-white rounded-2xl border-2 border-slate-100 shadow-sm p-6 space-y-4">
        {/* Title skeleton */}
        <div className="h-8 w-2/3 mx-auto bg-slate-200 rounded-lg skeleton-shimmer" />

        {/* Description lines */}
        <div className="space-y-3">
          <div className="h-4 w-full bg-slate-200 rounded skeleton-shimmer" />
          <div className="h-4 w-5/6 bg-slate-200 rounded skeleton-shimmer" />
          <div className="h-4 w-4/6 bg-slate-200 rounded skeleton-shimmer" />
        </div>

        {/* Button skeleton */}
        <div className="h-12 w-40 mx-auto bg-slate-200 rounded-xl skeleton-shimmer mt-4" />
      </div>
    </div>
  );
}

export function SkeletonDashboard({ className }: LessonSkeletonProps) {
  return (
    <div aria-label="Cargando panel" aria-busy="true" className={cn('p-6', className)}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-8">
        <div className="h-8 w-48 bg-slate-200 rounded-lg skeleton-shimmer" />
        <div className="flex items-center gap-4">
          <div className="h-4 w-24 bg-slate-200 rounded skeleton-shimmer" />
          <div className="w-8 h-8 bg-slate-200 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2 mb-6">
        <div className="h-10 w-28 bg-slate-200 rounded-lg skeleton-shimmer" />
        <div className="h-10 w-28 bg-slate-200 rounded-lg skeleton-shimmer" />
      </div>

      {/* Cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonAuth({ className }: LessonSkeletonProps) {
  return (
    <div
      aria-label="Cargando página de autenticación"
      aria-busy="true"
      className={cn('flex items-center justify-center min-h-screen p-6', className)}
    >
      <div className="w-full max-w-sm">
        {/* Logo skeleton */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto bg-slate-200 rounded-3xl skeleton-shimmer" />
          <div className="h-8 w-48 mx-auto mt-4 bg-slate-200 rounded-lg skeleton-shimmer" />
          <div className="h-4 w-32 mx-auto mt-2 bg-slate-200 rounded skeleton-shimmer" />
        </div>

        {/* Form skeleton */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
          {/* Input fields */}
          <div className="space-y-1">
            <div className="h-4 w-20 bg-slate-200 rounded skeleton-shimmer" />
            <div className="h-12 w-full bg-slate-200 rounded-xl skeleton-shimmer" />
          </div>

          <div className="space-y-1">
            <div className="h-4 w-20 bg-slate-200 rounded skeleton-shimmer" />
            <div className="h-12 w-full bg-slate-200 rounded-xl skeleton-shimmer" />
          </div>

          {/* Button */}
          <div className="h-12 w-full bg-slate-200 rounded-xl skeleton-shimmer mt-4" />
        </div>

        {/* Footer skeleton */}
        <div className="mt-6 text-center">
          <div className="h-4 w-40 mx-auto bg-slate-200 rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

// ─── Re-export existing skeletons ──────────────────────────────────────────

export function CardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="h-6 w-2/3" shimmer />
        <Skeleton variant="text" className="h-4 w-16" shimmer />
      </div>
      <Skeleton variant="text" className="h-4 w-full" shimmer />
      <Skeleton variant="text" className="h-4 w-3/4" shimmer />
      <div className="flex items-center gap-2 pt-2">
        <Skeleton variant="circular" className="w-5 h-5" shimmer />
        <Skeleton variant="text" className="h-4 w-24" shimmer />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ columns = 3 }: { columns?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton variant="text" className="h-4 w-24" shimmer />
        </td>
      ))}
    </tr>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton variant="text" className="h-4 w-16 mb-1.5" shimmer />
        <Skeleton className="h-12 w-full" shimmer />
      </div>
      <div>
        <Skeleton variant="text" className="h-4 w-16 mb-1.5" shimmer />
        <Skeleton className="h-12 w-full" shimmer />
      </div>
      <Skeleton className="h-12 w-full" shimmer />
    </div>
  );
}
