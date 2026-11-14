import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { LegalDocumentContent } from "@/components/legal/LegalDocumentContent";

export const metadata = { title: "Terms of Service | Focoman", description: "Terms governing use of the Focoman studio operations platform." };

export default function TermsPage() {
  return <LegalDocumentLayout eyebrow="Legal agreement" title="Terms of Service" summary="These Terms govern access to Focoman, including studio workspaces and customer-facing tracking links.">
    <LegalDocumentContent kind="terms" />
  </LegalDocumentLayout>;
}
