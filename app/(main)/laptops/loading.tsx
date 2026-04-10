export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="h-8 w-48 bg-[#F0F0F0] rounded-xl animate-pulse mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl overflow-hidden border border-[#F0F0F0]">
            <div className="aspect-[4/3] bg-[#F5F5F7] animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="h-4 bg-[#F0F0F0] rounded animate-pulse w-3/4" />
              <div className="h-3 bg-[#F0F0F0] rounded animate-pulse w-1/2" />
              <div className="h-8 bg-[#F0F0F0] rounded-xl animate-pulse w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
