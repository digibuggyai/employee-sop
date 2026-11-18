"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Card from "@/components/Card";
import { AddDocumentButton, DocumentList, useDocuments } from "@/components/Documents";
import PageHeader from "@/components/PageHeader";
import { Segmented } from "@/components/form";
import { isAdmin } from "@/lib/api";

type Filter = "ALL" | "EVERYONE" | "MINE" | "OTHERS";

export default function DocumentsPage() {
  const { user } = useAuth();
  const { docs, error, reload } = useDocuments();
  const [filter, setFilter] = useState<Filter>("ALL");
  const admin = isAdmin(user);

  const shown =
    docs?.filter((d) =>
      filter === "EVERYONE"
        ? d.scope === "EVERYONE"
        : filter === "MINE"
          ? d.owner.id === user?.id && d.scope === "PERSONAL"
          : filter === "OTHERS"
            ? d.owner.id !== user?.id && d.scope === "PERSONAL"
            : true,
    ) ?? null;

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle={admin ? "KT docs and files for the team, plus everyone's own documents." : "KT docs from your admins, and your own saved documents."}
        actions={<AddDocumentButton onAdded={reload} />}
      />
      <div className="mb-4 overflow-x-auto">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "ALL", label: "All" },
            { value: "EVERYONE", label: "For everyone" },
            { value: "MINE", label: "Mine" },
            ...(admin ? [{ value: "OTHERS" as const, label: "Others' personal" }] : []),
          ]}
        />
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <Card flush>
        <DocumentList docs={shown} onChanged={reload} empty={filter === "ALL" ? undefined : "Nothing here yet"} />
      </Card>
    </>
  );
}
