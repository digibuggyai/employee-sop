"use client";

import { useState } from "react";
import type { Person } from "@/lib/api";
import { photoUrl } from "@/lib/image";

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

const sizes = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-9 text-[13px]", lg: "size-14 text-lg", xl: "size-24 text-3xl" };

export default function Avatar({ person, size = "md" }: { person: Person; size?: keyof typeof sizes }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = person.id && person.photoUpdatedAt ? photoUrl(person.id, person.photoUpdatedAt) : null;

  if (src && failedSrc !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        onError={() => setFailedSrc(src)}
        className={`shrink-0 rounded-full bg-zinc-100 object-cover ${sizes[size]}`}
      />
    );
  }

  const initials = person.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
  const hash = [...person.name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0);

  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${palettes[hash % palettes.length]} ${sizes[size]}`}
    >
      {initials}
    </span>
  );
}
