import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";

export const metadata = { title: "Billing, Cancellation and Refunds | Focoman", description: "Pricing, billing, cancellation and refund terms for Focoman subscriptions." };

export default function BillingAndRefundsPage() {
  return <LegalDocumentLayout eyebrow="Billing policy" title="Billing, Cancellation and Refund Policy" summary="This policy explains the public plan structure and the rules that apply when Focoman begins collecting a subscription payment.">
    <section><h2>1. Plan structure</h2><p>Focoman offers Free, Starter and Professional plans. The pricing page identifies the features, price, billing period and stated limits for each plan. Free access does not create a payment obligation.</p></section>
    <section><h2>2. Charges and renewals</h2><p>When paid subscriptions are available, the payment screen will show the amount, currency, billing interval, taxes where applicable, and payment method before a charge is made. A feature selection alone is not a completed payment. A subscription renews only on the terms shown at checkout.</p><p>Third-party provider charges, including messaging or payment processing charges, are not included unless the pricing page expressly says that they are included.</p></section>
    <section><h2>3. Cancellation</h2><p>A studio owner may cancel through available account controls or by writing to support@focoman.com. Cancellation stops the next renewal. The studio keeps access to paid features until the end of the current paid period unless access is suspended under the Terms of Service.</p></section>
    <section><h2>4. Refunds</h2><p>Refund eligibility is measured from the start of the paid subscription period. A request must identify the studio workspace and payment reference.</p><ul><li>Requests made during the first 7 calendar days are eligible for a refund of the subscription amount paid for that period.</li><li>Requests made from day 8 through day 14 are eligible for a refund of 50% of the subscription amount paid for that period.</li><li>Requests made from day 15 onward are not eligible for a refund for that period.</li></ul><p>Refunds remain subject to applicable law.</p></section>
    <section><h2>5. Plan changes</h2><p>Upgrade, downgrade and feature-change treatment will be shown before confirmation when paid billing is enabled. Until that workflow is available, the price list is informational and Focoman will not claim that a payment has been collected.</p></section>
  </LegalDocumentLayout>;
}
