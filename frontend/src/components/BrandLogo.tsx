import Image from "next/image";

const files = {
  full: { dark: "/brand/digibuggy-logo.png", light: "/brand/digibuggy-logo-light.png", width: 640, height: 72 },
  mark: { dark: "/brand/digibuggy-mark.png", light: "/brand/digibuggy-mark.png", width: 94, height: 72 },
};

export default function BrandLogo({
  tone = "dark",
  variant = "full",
  className = "h-5 w-auto",
  priority = false,
}: {
  tone?: "dark" | "light";
  variant?: "full" | "mark";
  className?: string;
  priority?: boolean;
}) {
  const f = files[variant];
  return (
    <Image src={f[tone]} width={f.width} height={f.height} alt="Digibuggy" priority={priority} className={className} />
  );
}
