// Initials in a soft colour circle: "Adya Agrawal" → "AA".
// The colour comes from the name, so each person always gets the same one
// and people are easy to tell apart in long lists.
const palettes = [
  "bg-rose-100 text-rose-800",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
  "bg-teal-100 text-teal-800",
  "bg-orange-100 text-orange-800",
  "bg-indigo-100 text-indigo-800",
];

const sizes = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-9 text-[13px]", lg: "size-14 text-lg" };

export default function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof sizes }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
  // simple string hash → palette index
  const hash = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0);

  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${palettes[hash % palettes.length]} ${sizes[size]}`}
    >
      {initials}
    </span>
  );
}
