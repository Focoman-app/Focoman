import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { LegalDocumentContent } from "@/components/legal/LegalDocumentContent";

export const metadata = { title: "Privacy Policy | Focoman", description: "How Focoman handles account, studio and customer information." };

export default function PrivacyPage() {
  return <LegalDocumentLayout eyebrow="Privacy" title="Privacy Policy" summary="This policy explains what information Focoman handles, why it is used, how workspace data is separated, and how to request access, correction or deletion.">
    <LegalDocumentContent kind="privacy" />
  </LegalDocumentLayout>;
}
