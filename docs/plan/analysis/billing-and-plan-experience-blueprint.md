# Billing and Plan Experience Blueprint

Status: approved

## Receipt Contract

- A Receipt action is scoped to exactly one recorded payment/installment.
- It opens the receipt output directly; it must not open an invoice/receipt selector or generic issued-document workspace.
- Receipt branding uses the studio name and saved studio logo. When no studio logo is available, use the existing FocoMan mark; do not invent a studio logo.
- Receipt contents show the paid amount, actual receipt date, payment method/reference where present, customer/order identity, and receipt number.

## Final Invoice Contract

- An invoice is one final order-level document, not a payment receipt.
- It lists selected packages/services and their order charges, plus agreed total, payment summary, and balance/delivery context.
- It is enabled only after all three durable conditions are true: customer delivery confirmation, Studio Owner delivery confirmation, and full recorded payment.
- Before eligibility, the Invoice action remains disabled and names the unmet conditions. Payment receipts remain available independently.

## Settings Plan Contract

- Settings presents the current subscription plan rather than editable individual module toggles.
- Use the current product plan model and existing labels: Free (₹0), ₹999 paid tier, and Complete (₹1,999).
- Each plan card describes included capabilities and routes owners to the existing checkout/upgrade flow.
- Settings never grants or modifies paid capabilities. Verified payment/entitlement state remains the only activation authority.

## Integration

```text
OMS payment row ── Receipt click ──► issue/retrieve one payment receipt ──► PDF

OMS invoice action ──► eligibility context
    ├─ full payment
    ├─ customer delivery confirmation
    └─ owner delivery confirmation
         └─ all true ──► final invoice issue/download

Settings plan view ──► read planInfo/capabilities ──► checkout upgrade link
```

## Verification

- Receipt action cannot issue a document for any payment other than the clicked payment.
- Invoice issuance rejects every unmet completion condition server-side.
- Settings UI cannot write capability changes; upgrade is navigation only.
- Billing output uses actual saved branding/data and visibly represents unavailable states.
