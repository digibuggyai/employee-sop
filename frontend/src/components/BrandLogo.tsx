import Image from "next/image";

// The official dgB logo. Files live in public/brand/ (made from dgbindia.com's logo:
// trimmed, transparent background, and a white-letter version for dark backgrounds).
//   tone "dark"  → for light backgrounds (dark grey "dg")
//   tone "light" → for dark backgrounds (white "dg")
//   tagline      → include "Redefining Your Needs"
const files = {
  dark: { src: "/brand/logo.png", width: 427, height: 160 },
  light: { src: "/brand/logo-light.png", width: 427, height: 160 },
  darkTagline: { src: "/brand/logo-full.png", width: 503, height: 240 },
  lightTagline: { src: "/brand/logo-full-light.png", width: 503, height: 240 },
};

export default function BrandLogo({
  tone = "dark",
  tagline = false,
  className = "h-7 w-auto", // set the height; width follows
  priority = false,
}: {
  tone?: "dark" | "light";
  tagline?: boolean;
  className?: string;
  priority?: boolean; // true for logos visible on first paint (loads them first)
}) {
  const f = files[tagline ? (`${tone}Tagline` as const) : tone];
  return <Image src={f.src} width={f.width} height={f.height} alt="Digibuggy" priority={priority} className={className} />;
}
