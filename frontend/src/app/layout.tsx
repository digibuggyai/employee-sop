import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import { FeedbackProvider } from "@/components/Feedback";

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
  // iPhone "Add to Home Screen": open full-screen with our name
  appleWebApp: { capable: true, title: "Digibuggy", statusBarStyle: "default" },
};

// Phone browser settings. viewportFit "cover" lets us use the space around the notch /
// home indicator (we pad for it with env(safe-area-inset-*)). themeColor tints the browser bar.
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
        {/* AuthProvider = who's logged in · FeedbackProvider = toasts + confirm dialog
            AppShell = gatekeeper + sidebar / tab bar */}
        <AuthProvider>
          <FeedbackProvider>
            <AppShell>{children}</AppShell>
          </FeedbackProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
