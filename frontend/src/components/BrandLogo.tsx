import Image from "next/image";

// The official Digibuggy logo (navy bee + DIGIBUGGY). Files live in public/brand/.
//   tone "dark"  → navy, for light backgrounds
//   tone "light" → white, for dark/navy backgrounds
//   variant "mark" → just the bee (for tight spaces)
const files = {
  full: { dark: "/brand/digibuggy-logo.png", light: "/brand/digibuggy-logo-light.png", width: 640, height: 72 },
  mark: { dark: "/brand/digibuggy-mark.png", light: "/brand/digibuggy-mark.png", width: 94, height: 72 },
};

export default function BrandLogo({
  tone = "dark",
  variant = "full",
  className = "h-5 w-auto", // set the height; width follows the logo's proportions
  priority = false,
}: {
  tone?: "dark" | "light";
  variant?: "full" | "mark";
  className?: string;
  priority?: boolean; // true for logos visible on first paint (loads them first)
}) {
  const f = files[variant];
  return (
    <Image src={f[tone]} width={f.width} height={f.height} alt="Digibuggy" priority={priority} className={className} />
  );
}
