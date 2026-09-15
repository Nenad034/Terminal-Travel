# TravelgateX HotelX Pull Buyers API — Certification Handoff

## Context
- **Company**: Terminal Travel Agency (Olympic Travel), licensed tour operator in Serbia (olympic.rs, Kragujevac)
- **Owner/director**: Nenad
- **Purpose of this document**: Full record of the TravelgateX HotelX Pull Buyers API onboarding/certification process, so another AI agent or developer can pick up the work (production activation, platform integration, etc.) without losing context.

## Certification Process
Completed at: https://app.travelgate.com/onboarding-implementation

Phases (in order):
1. **Content**
2. **Case: Refundable**
3. **Case: Non Refundable**
4. **Case: Payment Card** (optional)
5. **Confirm**

## Technical Setup

- **Endpoint**: single GraphQL endpoint — `https://api.travelgate.com`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Apikey test0000-0000-0000-0000-000000000000`
  - ⚠️ Do **not** add a custom `Client` header — this causes a CORS failure.
- **Client identification**: goes inside the GraphQL query's `settings.client` field, value: `"client_demo"`
- **Test hotel codes**: `BR1518`, `ES284122`
- **Access filter**: `"2"`
- **Payment Card phase**: use `PaymentCardInput` with test Visa number `4111111111111111`, payment type `DIRECT`

## Status (as of 2026-09-15)

✅ **All certification phases completed 100%**:
- Content — done
- Case: Refundable — done
- Case: Non Refundable — done
- Case: Payment Card (optional) — done

✅ **Final "Confirm" step reached** — TravelgateX platform shows: *"Your company is ready to start using our platform."* Olympic Travel can now activate live/production connections.

📌 **Next step (pending, external)**: TravelgateX onboarding team said they will follow up to schedule a **platform walkthrough**.

## Administrative Notes
- All files created during this certification process were saved both in-chat and to a Google Drive folder: **"TravelgateX Certification - Olympic Travel"** (folder id: `1hFk9X1Qos6BEdKSKn54WWSv1lRoHjEcS`)
- This record is kept in case the certification details are needed again in the future (e.g., for production setup, credential rotation, or a new integration built on top of this API).

---
*Generated from Claude's memory of the TravelgateX certification project for handoff purposes.*
