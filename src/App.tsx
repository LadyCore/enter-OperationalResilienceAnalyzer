import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { OraProvider } from "@/store/OraContext";
import { routers } from "./router";

const queryClient = new QueryClient();

const App = () => {
  const router = createBrowserRouter(routers);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OraProvider>
          <Toaster />
          <Sonner />
          <RouterProvider router={router} />
        </OraProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
