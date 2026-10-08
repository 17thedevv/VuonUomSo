# FC3-1A — Backup Shortage + Stale Reservation Undo Safety

Status: **CLOSED / ACCEPTED / MERGED**. FC3-0/FC3-1B CLOSED; FC3-1 và FC3 overall chưa DONE; **FC3-2 NEXT**.

Người dùng nghiệm thu exact-head `ad4010fcc3dda64f3c451aa204d5852488a7bff3`: PASS / MERGE READY. [PR #14](https://github.com/17thedevv/VuonUomSo/pull/14) merged tại `261f7ddddbefb92c07173f813950bf2ec2b54614`; [CI trên merge commit SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37760585326).

Base: `main` tại `6f1f403a05e8a37299b49b00955eae796d0f1baf`.
Branch implementation: `feat/fc3-reservation-reconciliation`. Safety slice đã được nghiệm thu và merge trước khi triển khai reconciliation service.

## Backup compatibility

Chỉ bỏ invariant cũ `activeOutstanding <= readyQuantity`. Shortage hợp lệ theo FC0/FC3 được export, preview, restore và đọc lại nguyên trạng. Không tăng ready, giảm nguồn, clamp số hay tự reconciliation. Không đổi schema/format.

Regression dùng workspace Dexie có Q/F, nguồn trong/ngoài, planned/completed shipment, hồ sơ và events:

| Case | Kết quả cần giữ sau export → preview → restore → reopen IndexedDB |
| --- | --- |
| Ready15k, own Q28k/F10k/O18k | Thiếu3k, còn bán0, living40k/ready15k không đổi |
| Ready15k, own Q27k/F10k/O17k, fixture partial history | Thiếu2k, còn bán0; Q/F/status/references, toàn bộ history giữ nguyên |
| Shortage kèm Q0/F>Q/status sai/reference order/batch/supplier hỏng | Reject trước ghi; workspace hiện tại giữ nguyên |
| Planned allocation19k > O18k, completed/F mismatch, coverage vượt requested | Reject; các integrity guards còn nguyên |

Fixture partial ghi trực tiếp state/history để mô phỏng trạng thái hợp lệ; **không gọi reconciliation service**, vì slice này chưa triển khai service đó. Các guards living/ready/initial, status và fulfillment hiện có tiếp tục được suite backup bảo vệ.

## Reservation Undo safety

Own/external creation capture bản sao reservation (ID/order/Q/F/status/source/batch/supplier/createdAt) và tập ID order events bên trong creation transaction. Undo chỉ dùng snapshot trong bộ nhớ; không thêm version/schema/event format.

Undo mở Dexie rw transaction bao phủ batches/orders/reservations/shipments/events/contacts, đọc lại facts, xác minh reference còn tồn tại và lịch sử còn nguyên, rồi gọi release service hiện có bằng nested transaction chung với outer transaction. Guard → release → order status → events cùng commit/rollback; không có check ngoài transaction cấp quyền release.

Guard lịch sử cố ý bảo thủ: **bất kỳ thay đổi tập order event IDs sau creation** đều làm Undo stale, kể cả correction metadata/nguồn khác của cùng đơn. Không suy diễn semantics từ payload reconciliation chưa được triển khai. Mọi shipment history có line trỏ tới reservation (planned/cancelled/completed) cũng chặn. Event IDs được so khớp thay timestamp để không bỏ lọt thao tác cùng mili giây. Future reconciliation phải tiếp tục append order timeline events như contract §7.

Stale/missing/changed reservation trả `Không thể hoàn tác vì nguồn giữ đã thay đổi sau thao tác này.`, clear banner; không thêm release event hoặc thay physical stock. Event persistence failure rollback cả release/order/events, cho phép retry intent còn nguyên. Không thêm Undo reconciliation.

Real Dexie/service regressions:

- Fresh own10k → released, availability phục hồi, living/ready giữ nguyên; fresh external tương tự.
- Captured10k → DB quantity7k → Undo cũ fail, state/coverage/history giữ nguyên.
- Real plan/confirm3k → Undo cũ fail, F3k/completed shipment/living22k/ready17k giữ nguyên.
- Q/F/status/source/order/batch/supplier facts đổi hoặc reservation bị xóa → fail, không false release event.
- Simulated reduction/history rồi Q trở lại10k; event cùng timestamp; xóa creation history → vẫn fail.
- Real planned/cancelled shipment history → fail dù reservation facts chưa đổi.
- Event thứ hai thất bại → rollback cả release/order và event thứ nhất.
- Writer reduction xếp trước Undo → old intent không release7k; duplicate concurrent Undo → chỉ một release.
- Writer được xếp sau guard read → phải đợi Undo commit; guard/release reads nằm trong outer/nested transaction chung.

## Verification và giới hạn

Regression được chạy trên code cũ để xác nhận failure trước patch, rồi kiểm targeted/related suites. Full local gate: **typecheck PASS, lint0/0, 43 files / 406 tests PASS, build PASS, PWA14 entries**. Có 30 regression mới (11 backup, 19 Undo). Exact-head CI và SHA được ghi trong PR/report handoff.

Không có reconciliation mutation/UI, order reduction/transfer/batch reconciliation, FC4/FC5, generic inventory, đổi tên hay dependency/schema mới. Không cần browser acceptance cho slice không đổi UI.

**Required real-service gate — PASS trong FC3-1B:** [implementation ACCEPTED / MERGED](FC3-1B-ORDER-REDUCTION.md), PR #16 và CI merge xanh. Regression capture Undo → reconciliation service thật commit → old Undo fail bảo toàn nguồn/coverage/history/stock, gồm partial reduction, nguồn không đổi nhưng requested giảm và full release. Fixture 1A không thay thế acceptance này. UI chưa expose; FC3-2 NEXT.
