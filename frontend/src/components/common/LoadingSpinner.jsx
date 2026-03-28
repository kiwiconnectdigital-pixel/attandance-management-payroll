export default function LoadingSpinner({ fullScreen = true, size = 'md' }) {
  const sizeClass = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' }[size];

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center">
          <div className={`${sizeClass} border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto`} />
          <p className="mt-3 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className={`${sizeClass} border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin`} />
    </div>
  );
}