# OMS Free-Tier Actions

Status: Approved

## Entitlement contract

| Capability | OMS UI |
|---|---|
| `OMS_BASIC` / `OMS_CORE` only | Orders list, Register Confirmed Order, Filters |
| `CUSTOMER_CRM` | Orders/Leads tabs and Leads data/UI |
| `BUSINESS_REPORTS` | Export Excel action |

## Layout

```text
Free:    title → context → Register order + Filters → orders
Entitled: title → context → Orders/Leads → Register + Filters + Export → content
```

The singleton Orders tab is not rendered. Filters remain available independently
of export, so Free users retain search/state/sort controls.
