import { Construction } from "lucide-react";
import Card from "./Card";
import { EmptyState } from "./ui";

export default function ComingSoon({ what }: { what: string; step?: string }) {
  return (
    <Card>
      <EmptyState icon={Construction} title={what} description="This section is being built and will be available soon." />
    </Card>
  );
}
