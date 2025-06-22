import { Authenticated, Unauthenticated, useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster, toast } from "sonner";
import { useState, useEffect } from "react";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <h2 className="text-xl font-semibold text-blue-600">🚚 SupplyChainPro</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 p-4">
        <Content />
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <Authenticated>
        <LogisticsDashboard />
      </Authenticated>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-96 gap-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              SupplyChainPro
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Professional supply chain management and insights
            </p>
          </div>
          <SignInForm />
        </div>
      </Unauthenticated>
    </div>
  );
}

function LogisticsDashboard() {
  const [query, setQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<any>(null);
  
  const dashboardStats = useQuery(api.logistics.getDashboardStats);
  const alerts = useQuery(api.logistics.getAlerts);
  const queryHistory = useQuery(api.logistics.getQueryHistory);
  const processQuery = useAction(api.logistics.processQuery);
  const initializeData = useMutation(api.logistics.initializeSampleData);

  useEffect(() => {
    if (dashboardStats && dashboardStats.totalSuppliers === 0) {
      initializeData().then(() => {
        toast.success("Sample supply chain data loaded!");
      }).catch(() => {
        toast.error("Failed to load sample data");
      });
    }
  }, [dashboardStats, initializeData]);

  const handleSubmitQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const response = await processQuery({ question: query });
      setCurrentResponse(response);
      setQuery("");
      toast.success("Query processed successfully!");
    } catch (error) {
      toast.error("Failed to process query");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const sampleQuestions = [
    "Which supplier is causing delays?",
    "What should I reorder this week?",
    "Which suppliers have the lowest reliability?",
    "What products will be out of stock next week?",
    "Show me all delayed shipments",
    "What are the current inventory levels?",
  ];

  return (
    <div className="space-y-6">
      {dashboardStats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Suppliers" value={dashboardStats.totalSuppliers} />
          <StatCard title="Products" value={dashboardStats.totalProducts} />
          <StatCard title="Active Shipments" value={dashboardStats.activeShipments} />
          <StatCard title="Delayed" value={dashboardStats.delayedShipments} color="red" />
          <StatCard title="Avg Reliability" value={`${dashboardStats.avgSupplierReliability}%`} />
          <StatCard title="Active Alerts" value={dashboardStats.activeAlerts} color="orange" />
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">Ask Your Logistics Assistant</h2>
        
        <form onSubmit={handleSubmitQuery} className="space-y-4">
          <div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask me anything about your supply chain..."
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-gray-600">Try asking:</span>
            {sampleQuestions.map((question, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setQuery(question)}
                className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-100 transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
          
          <button
            type="submit"
            disabled={!query.trim() || isProcessing}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? "Processing..." : "Ask Assistant"}
          </button>
        </form>

        {currentResponse && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Response:</h3>
            <p className="text-gray-700 mb-4">{currentResponse.response}</p>
            
            {currentResponse.insights.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Key Insights:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {currentResponse.insights.map((insight: string, index: number) => (
                    <li key={index} className="text-gray-700">{insight}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {currentResponse.recommendations.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Recommendations:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {currentResponse.recommendations.map((rec: string, index: number) => (
                    <li key={index} className="text-gray-700">{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {alerts && alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Active Alerts</h2>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert._id}
                className={`p-3 rounded-lg border-l-4 ${
                  alert.severity === "high"
                    ? "bg-red-50 border-red-400"
                    : alert.severity === "medium"
                    ? "bg-yellow-50 border-yellow-400"
                    : "bg-blue-50 border-blue-400"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">{alert.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      alert.severity === "high"
                        ? "bg-red-100 text-red-800"
                        : alert.severity === "medium"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {alert.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {queryHistory && queryHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Queries</h2>
          <div className="space-y-3">
            {queryHistory.map((queryItem) => (
              <div key={queryItem._id} className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900 mb-1">{queryItem.question}</p>
                <p className="text-sm text-gray-600">{queryItem.response}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(queryItem.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  color = "blue" 
}: { 
  title: string; 
  value: string | number; 
  color?: "blue" | "red" | "orange" | "green";
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    red: "bg-red-50 text-red-700 border-red-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    green: "bg-green-50 text-green-700 border-green-200",
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <h3 className="text-sm font-medium opacity-80">{title}</h3>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
} 