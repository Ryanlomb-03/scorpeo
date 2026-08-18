import type { Metadata, Viewport } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ChatProvider } from "@/context/ChatContext";
import { SidebarProvider } from "@/context/SidebarContext";
import LayoutShell from "@/components/LayoutShell";

export const metadata: Metadata = {
  title: "Scorpio",
  description: "AI Chat Interface",
  icons: {
    icon: "/logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js" async></script>
      </head>
      <body className="bg-neutral-900 text-white antialiased font-medium">
        <ChatProvider>
          <SidebarProvider>
            <LayoutShell>
              {children}
            </LayoutShell>
          </SidebarProvider>
        </ChatProvider>
      </body>
    </html>
  );
}
