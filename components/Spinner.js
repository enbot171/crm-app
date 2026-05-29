export default function Spinner({ fullScreen }) {
  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-7 h-7 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }
  return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 rounded-full border-2 border-black border-t-transparent animate-spin" />
    </div>
  );
}
