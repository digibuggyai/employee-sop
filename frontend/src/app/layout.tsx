import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import { FeedbackProvider } from "@/components/Feedback";
import { PendingProvider } from "@/components/Pending";
import { NotificationsProvider } from "@/components/Notifications";
import { PresenceProvider } from "@/components/Presence";
import { ProfileProvider } from "@/components/ProfileSheet";
import { themeScript } from "@/components/ThemeToggle";

const geistSans = IBM_Plex_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = IBM_Plex_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans">
        <AuthProvider>
          <PendingProvider>
            <FeedbackProvider>
              <NotificationsProvider>
                <PresenceProvider>
                  <ProfileProvider>
                    <AppShell>{children}</AppShell>
                  </ProfileProvider>
                </PresenceProvider>
              </NotificationsProvider>
            </FeedbackProvider>
          </PendingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
