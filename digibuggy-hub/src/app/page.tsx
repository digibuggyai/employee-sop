import Link from "next/link";

// The modules we'll build. For now this is just a plain list in code;
// later it will depend on who is logged in (employee vs admin).
const modules = [
  { href: "/attendance", title: "Attendance", desc: "Check in / check out, monthly calendar" },
  { href: "/tasks", title: "Tasks", desc: "Your daily task log" },
  { href: "/leave", title: "Leave & WFH", desc: "Request leave or work from home" },
  { href: "/notices", title: "Notice Board", desc: "Policies and announcements" },
  { href: "/directory", title: "Directory", desc: "Everyone at Digibuggy" },
  { href: "/sops", title: "SOPs", desc: "How we do things" },
];

// page.tsx inside src/app = the "/" route (the home page).
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <h1 className="text-3xl font-bold">Digibuggy Hub</h1>
      <p className="mt-1 text-gray-500">Attendance, tasks and SOPs in one place.</p>

      {/* .map() turns each item of the array into a card */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-xl border border-gray-200 p-5 transition hover:border-red-700 hover:shadow"
          >
            <h2 className="font-semibold">{m.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{m.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
