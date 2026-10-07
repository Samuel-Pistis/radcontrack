import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import DailyUsage from "./pages/DailyUsage";
import AuditHistory from "./pages/AuditHistory";
import Auth from "./pages/Auth";
import ContrastUsage from "./pages/ContrastUsage";
import WeeklyTrend from "./pages/WeeklyTrend";
import Inventory from "./pages/Inventory";
import SharedStock from "./pages/SharedStock";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "./components/AuthProvider";

const queryClient = new QueryClient();
const StockLanding = () => {
  const {canManageStock}=useAuth();
  return <Navigate to={canManageStock ? '/stock/receive' : '/stock/pick'} replace />;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, hasAccess } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !hasAccess) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, hasAccess } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProtectedRoute><DailyUsage /></ProtectedRoute>} />
          <Route path="/clinical" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/usage" element={<ProtectedRoute><ContrastUsage /></ProtectedRoute>} />
          <Route path="/weekly-trend" element={<ProtectedRoute><WeeklyTrend /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
          <Route path="/stock" element={<ProtectedRoute><StockLanding /></ProtectedRoute>} />
          {(['pick','receive','count','balances','history','access'] as const).map(view => <Route key={view} path={`/stock/${view}`} element={<ProtectedRoute><SharedStock key={view} view={view} /></ProtectedRoute>} />)}
          <Route path="/audit" element={<ProtectedRoute><AuditHistory /></ProtectedRoute>} />
          <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
