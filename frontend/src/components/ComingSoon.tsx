import { Hammer } from "lucide-react";
import Card from "./Card";

// Placeholder for modules we haven't built yet, so links never hit a 404.
export default function ComingSoon({ what, step }: { what: string; step: string }) {
  return (
    <Card>
      <div className="flex flex-col items-center py-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-700">
          <Hammer size={22} />
        </span>
        <p className="mt-4 font-medium">{what}</p>
        <p className="mt-1 text-sm text-zinc-500">Coming in {step}.</p>
      </div>
    </Card>
  );
}
