"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { SerwistProvider } from "@serwist/next/react";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    // Registers src/app/sw.ts (built to public/sw.js) on the client. Without
    // this, no service worker is ever registered — offline support, PWA
    // installability, and (critically) Web Push all silently don't work,
    // with no error anywhere: navigator.serviceWorker.ready just never
    // resolves.
    <SerwistProvider swUrl="/sw.js">
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </ThemeProvider>
    </SerwistProvider>
  );
}
