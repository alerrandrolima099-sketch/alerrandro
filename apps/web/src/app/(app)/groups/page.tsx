"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { GroupsPanel } from "@/components/panels/GroupsPanel";

export default function GroupsPage() {
  return (
    <div>
      <PageHeader title="Grupos / Comunidades" />
      <GroupsPanel />
    </div>
  );
}
