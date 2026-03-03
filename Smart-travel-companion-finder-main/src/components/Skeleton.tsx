/** Reusable shimmer/skeleton loader blocks. */
export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export function ConversationSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonLine className="h-4 w-28" />
              <SkeletonLine className="h-3 w-48" />
            </div>
            <SkeletonLine className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReviewSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
            <div className="space-y-2 flex-1">
              <SkeletonLine className="h-4 w-32" />
              <SkeletonLine className="h-3 w-20" />
            </div>
          </div>
          <SkeletonLine className="h-3 w-full" />
          <SkeletonLine className="h-3 w-3/4 mt-2" />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gray-200" />
        <div className="space-y-2 flex-1">
          <SkeletonLine className="h-5 w-40" />
          <SkeletonLine className="h-3 w-24" />
        </div>
      </div>
      <SkeletonLine className="h-4 w-full" />
      <SkeletonLine className="h-4 w-5/6" />
      <SkeletonLine className="h-4 w-2/3" />
      <div className="grid grid-cols-3 gap-3 pt-4">
        <SkeletonLine className="h-20 rounded-lg" />
        <SkeletonLine className="h-20 rounded-lg" />
        <SkeletonLine className="h-20 rounded-lg" />
      </div>
    </div>
  );
}
