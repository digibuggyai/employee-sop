import Link from "next/link";

// This file lives at src/app/attendance/page.tsx, so Next.js serves it at /attendance.
// The folder name becomes the URL. That's "file-based routing".
export default function AttendancePage() {
  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <Link href="/" className="text-sm text-red-700 hover:underline">
        ← Back to home
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Attendance</h1>
      <p className="mt-2 text-gray-500">The check-in button and calendar will go here.</p>
    </main>
  );
}
