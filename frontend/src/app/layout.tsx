import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import { FeedbackProvider } from "@/components/Feedback";
import { PendingProvider } from "@/components/Pending";
import { NotificationsProvider } from "@/components/Notifications";
import { PresenceProvider } from "@/components/Presence";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Digibuggy Hub", template: "%s · Digibuggy Hub" },
  description: "Attendance, tasks and leave for the Digibuggy team",
  appleWebApp: { capable: true, title: "Digibuggy", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <AuthProvider>
          <PendingProvider>
            <FeedbackProvider>
              <NotificationsProvider>
                <PresenceProvider>
                  <AppShell>{children}</AppShell>
                </PresenceProvider>
              </NotificationsProvider>
            </FeedbackProvider>
          </PendingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
