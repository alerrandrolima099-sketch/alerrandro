"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { ContactsPanel } from "@/components/panels/ContactsPanel";

export default function ContactsPage() {
  return (
    <div>
      <PageHeader title="Contatos" />
      <ContactsPanel />
    </div>
  );
}
