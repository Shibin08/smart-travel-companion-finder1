export default function MatchCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-1/3" />
        <div className="h-3 bg-gray-200 rounded" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
        <div className="flex gap-2 pt-2">
          <div className="h-7 bg-gray-200 rounded w-20" />
          <div className="h-7 bg-gray-200 rounded w-24" />
        </div>
      </div>
    </div>
  );
}
