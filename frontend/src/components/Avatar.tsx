"use client";

import { useState } from "react";
import type { Person } from "@/lib/api";
import { photoUrl } from "@/lib/image";
import { usePresence } from "./Presence";
import { useOpenProfile } from "./profileContext";

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

const dotSizes = { xs: "size-2", sm: "size-2.5", md: "size-2.5", lg: "size-3.5", xl: "size-5 ring-[3px]" };

const sizes = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-9 text-[13px]", lg: "size-14 text-lg", xl: "size-24 text-3xl" };

export default function Avatar({ person, size = "md", profile = true }: { person: Person; size?: keyof typeof sizes; profile?: boolean }) {
  const { online: onlineIds } = usePresence();
  const openProfile = useOpenProfile();
  const online = !!person.id && onlineIds.has(person.id);
  const face = <Face person={person} size={size} />;
  const shown = online ? (
    <span className="relative inline-flex h-fit shrink-0" title="Online now">
      {face}
      <span aria-label="Online" className={`absolute right-0 bottom-0 rounded-full bg-emerald-500 ring-2 ring-white ${dotSizes[size]}`} />
    </span>
  ) : (
    face
  );
  if (!profile || !person.id) return shown;
  const open = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openProfile(person.id!);
  };
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`Open ${person.name}'s profile`}
      onClick={open}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(e)}
      className="inline-flex h-fit shrink-0 cursor-pointer rounded-full transition hover:opacity-85"
    >
      {shown}
    </span>
  );
}

function Face({ person, size }: { person: Person; size: keyof typeof sizes }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = person.id && person.photoUpdatedAt ? photoUrl(person.id, person.photoUpdatedAt) : null;

  if (src && failedSrc !== src) {
    return (
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
