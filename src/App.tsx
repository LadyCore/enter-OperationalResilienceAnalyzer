import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppErrorBoundary } from "@/components/common/AppErrorBoundary";
import { OraProvider } from "@/store/OraContext";
import { AuthGate } from "@/components/auth/AuthGate";
import { startClientErrorReporting } from "@/lib/clientErrors";

const App = () => {
  // Install global error listeners (idempotent). Errors are sent to the
  // client-error-log backend function with route + user-agent context.
  startClientErrorReporting();

  return (
    <TooltipProvider>
      <AppErrorBoundary>
        <OraProvider>
          <Sonner />
          <AuthGate />
        </OraProvider>
      </AppErrorBoundary>
    </TooltipProvider>
  );
};

export default App;
