// Round badge with initials: "Adya Agrawal" → "AA". Used until we add profile photos.
export default function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-brand-100 font-semibold text-brand-700 ${
        size === "lg" ? "h-16 w-16 text-xl" : "h-9 w-9 text-sm"
      }`}
    >
      {initials}
    </span>
  );
}
