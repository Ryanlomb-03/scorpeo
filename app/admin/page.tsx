import ModelMonitor from "@/components/ModelMonitor";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-neutral-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Scorpio Admin Dashboard</h1>
        <p className="text-gray-400 mb-8">Monitor and manage AI models</p>
        
        <ModelMonitor />
      </div>
    </div>
  );
}