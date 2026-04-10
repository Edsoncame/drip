export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="h-8 w-64 bg-[#F0F0F0] rounded-xl animate-pulse mb-2" />
      <div className="h-4 w-32 bg-[#F0F0F0] rounded animate-pulse mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
            <div className="h-8 w-8 bg-[#F0F0F0] rounded-xl animate-pulse mb-3" />
            <div className="h-4 w-24 bg-[#F0F0F0] rounded animate-pulse mb-1" />
            <div className="h-3 w-20 bg-[#F0F0F0] rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="h-48 bg-white border border-[#E5E5E5] rounded-2xl animate-pulse" />
    </div>
  );
}
