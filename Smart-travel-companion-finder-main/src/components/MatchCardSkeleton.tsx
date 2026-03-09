export default function MatchCardSkeleton() {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-200/80" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200/80 rounded-full w-1/2" />
        <div className="h-3 bg-gray-200/80 rounded-full w-1/3" />
        <div className="h-3 bg-gray-200/80 rounded-full" />
        <div className="h-3 bg-gray-200/80 rounded-full w-5/6" />
        <div className="flex gap-2 pt-2">
          <div className="h-8 bg-gray-200/80 rounded-xl w-20" />
          <div className="h-8 bg-gray-200/80 rounded-xl w-24" />
        </div>
      </div>
    </div>
  );
}
