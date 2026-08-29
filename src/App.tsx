import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OraProvider } from "@/store/OraContext";
import { AuthGate } from "@/components/auth/AuthGate";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OraProvider>
          <Toaster />
          <Sonner />
          <AuthGate />
        </OraProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
