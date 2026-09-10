export function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer ${className}`} />;
}

export function HomeSkeleton() {
  return (
    <div className="stremo-home grid h-full min-h-0 w-full grid-cols-1 gap-3 overflow-hidden p-3 sm:p-4">
      <div className="area-head flex items-end justify-between">
        <div>
          <Shimmer className="h-5 w-28 rounded-full" />
          <Shimmer className="mt-2 h-3 w-52 rounded-full" />
        </div>
        <Shimmer className="h-8 w-24 rounded-lg" />
      </div>
      <div className="area-kpis grid gap-3 sm:grid-cols-3">
        <Shimmer className="h-28 rounded-2xl" />
        <Shimmer className="h-28 rounded-2xl" />
        <Shimmer className="h-28 rounded-2xl" />
      </div>
      <Shimmer className="area-workspaces min-h-48 rounded-2xl" />
      <Shimmer className="area-attention min-h-36 rounded-2xl" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex h-full w-full flex-col px-3 pb-3 pt-1 sm:px-5 sm:pb-4">
      <Shimmer className="mb-2 h-5 w-36 rounded-full" />
      <Shimmer className="mb-5 h-3.5 w-72 max-w-full rounded-full" />
      <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Shimmer className="min-h-36 rounded-2xl" />
        <Shimmer className="min-h-36 rounded-2xl" />
        <Shimmer className="min-h-36 rounded-2xl" />
      </div>
    </div>
  );
}
