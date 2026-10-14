# REM-05 — PWA installation and physical-device acceptance

**Status: protocol only — physical evidence NOT VERIFIED.** Execute one consolidated device-verification round **after** the narrow PWA-assets change has been independently reviewed, merged and validated by first-attempt main CI. This protocol is not pilot authorization; historical R01–R08 statuses remain unchanged until a separate re-audit.

## Environment and preconditions

- Record exact main merge SHA, installed deployment/build SHA, production HTTPS origin, asset URLs and install timestamp. Confirm 192×192, 512×512 and 180×180 icons from the **deployed** origin, not dev assets.
- Devices: a **physical Android running Chrome** and a **physical iPhone running Safari**. Record model, OS/browser version, free storage and keyboard configuration. Desktop emulation is not device evidence.
- Work only with an isolated **synthetic** dataset. Before destructive restore/reset, export a known-good backup and confirm it exists in the device's native Downloads/Files app. Never overwrite live business data.
- Report each result as PASS, FAIL, BLOCKED or NOT VERIFIED. Preserve timestamps, version, screenshots without personal data, native file metadata and record before/after evidence.

## Consolidated device verification matrix

| Gate | Device action on Android **and** iOS | Required evidence |
|---|---|---|
| D01 Installability | Visit HTTPS URL; Android Chrome Install/Add to Home Screen; iOS Safari Add to Home Screen | Branded app icon, correct display/AppShell, no 1×1 or Vite placeholder; screenshot and manifest |
| D02 Offline cold start | After online install, kill app; enable Airplane Mode, confirm all network unavailable; launch from Home Screen | AppShell opens with prior IndexedDB facts, not just a retained tab; capture cache/build facts where observable |
| D03 Offline writes | While offline, perform one reversible synthetic batch quantity edit; kill and reopen, verify exact quantity; Undo and reopen | Durable one-command/one-event write, survives cold restart without network, Undo exact restored state |
| D04 Vietnamese native IME | Use physical keyboard Telex/VNI where supported: compose diacritics in variety, contact/name/search; edit cây/vạn numeric fields, backspace, select and move caret | Visible, parsed, submitted, and persisted facts identical; no caret jump/draft overwrite/double submit. Unsupported VNI is NOT VERIFIED |
| D05 Native Files restore | Export actual JSON via More, save to native Downloads/Files; choose that saved file in native picker, preview, restore and reload | Nine business store arrays/IDs/timestamps match exact backup. Telemetry two stores preserved, no false success or partial restore |
| D06 Invalid file | Pick a known synthetic malformed backup with mixed own/external source or unsafe quantity; then pick valid backup | Invalid preview rejected, restore disabled, zero destructive transactions, all 11 stores unchanged; valid recovery still works |
| D07 Cache/update | Re-enable network; verify authorized app update and reload on installed app | Updated version starts without IndexedDB data loss, build/cache/version observed |

## Readiness decision

1. Store a per-device matrix and synthetic-only screenshots/evidence outside product code. A missing device, unsupported keyboard, absent native file access or invalid certificate is BLOCKED/NOT VERIFIED, **not PASS**.
2. Any failing device gate needs its own correction/retest; do not silently fold it into REM-05 asset acceptance.
3. After device evidence is complete, run a **separate R01–R08 re-audit**, preserving historical baseline FAIL/NOT VERIFIED.
4. **REAL PILOT = NO-GO / NOT APPROVED / NOT STARTED** until explicit GO after re-audit. MCP AI Control and V2-C/D/E remain deferred.
