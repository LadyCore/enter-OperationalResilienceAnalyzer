import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OraProvider } from "@/store/OraContext";
import { AuthGate } from "@/components/auth/AuthGate";

const App = () => {
  return (
    <TooltipProvider>
      <OraProvider>
        <Sonner />
        <AuthGate />
      </OraProvider>
    </TooltipProvider>
  );
};

export default App;
