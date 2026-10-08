# FC2 — Final Acceptance

Ngày: 08/10/2026. Verdict: **PASS / FC2 DONE / FC3 NEXT**.

## Kết quả và phạm vi

Domain/service [PR #8](https://github.com/17thedevv/VuonUomSo/pull/8) và UI [PR #9](https://github.com/17thedevv/VuonUomSo/pull/9) đã được người dùng nghiệm thu. PR #9 merged tại `034b33058d90b7f0a70854c8e329f5106b42decd`; [CI merge SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37748317065). Mã web trên merge commit giống exact head đã duyệt `911e958533ba3dcfaa42af1639f86609f3fe92d0`.

Không phát hiện BLOCKER/HIGH hoặc lifecycle dead-end trong phạm vi FC2 và luồng đã kiểm tra. Giảm dưới lượng đã giữ bị chặn có giải thích; người dùng có thể đóng form, giữ nguyên nguồn, tiếp tục đơn hoặc hủy toàn bộ trước xuất. Đây là ranh giới FC2, không giả lập FC3. Sau xuất, không cho sửa/hủy toàn bộ; xử lý dừng phần còn lại vẫn thuộc FC5.

## Correctness → scope → architecture → UX → tests

- Chỉ các field sửa từ giá trị ban đầu được gửi khi edit. Note-only không ghi đè quantity/date/price mới từ edit khác. Quantity sửa có chủ đích áp dụng lần submit sau cùng, được validate trên current order/sources/shipments trong transaction. Event dùng current before, không dùng snapshot form cũ.
- Hủy atomic: release active reservations, cancel planned shipments, cancel order; giữ nguyên cây sống/đủ bán và lịch sử. Fingerprint preview được kiểm tại commit time; thay đổi tác động yêu cầu xem lại và xác nhận lần nữa. Completed shipment khóa whole-cancel. Undo create-order không xóa order đã có correction/source/shipment history.
- Không thêm schema, dependency, cloud/backend, reconciliation FC3, closed_remaining FC5 hoặc redesign UI-R03/R04/R05. UI dùng service; validation và quantity helpers ở domain. Không thay business stock formula trong lần nghiệm thu này.
- Browser mobile 390 × 844: conflict dễ đọc, footer/CTA vẫn thấy, dialog đóng được; document/body width đều 390, không overflow ngang ở màn conflict. Các breakpoint 360/430/1280 đã được kiểm trong slice 2, không chạy lại trong nghiệm thu ngắn này.
- Hai stale-order regression dùng updateOrder thật: note-only giữ 60k và date/price mới, changedFields chỉ note; intentional 55k lưu 55k và event 60k → 55k. Các tests còn lại bảo vệ coverage conflict, atomic rollback, duplicate cancellation, stale preview và completed shipment guards.

## End-to-end mobile trên main

Chạy bản merge `034b330` tại origin demo riêng `http://127.0.0.1:5187`, không dùng dữ liệu vườn hiện có. Mọi thao tác ghi qua UI, không gọi service/DB trực tiếp để dựng kết quả browser.

1. Từ Hôm nay, ghi đơn Anh Nam / Keo lai BV16 / 2 vạn (20.000), ngày mai.
2. Sửa thành 25.000 cây, giá 1.300 đồng, note “Nghiệm thu FC2: giao buổi sáng”; timeline 20.000 → 25.000 đúng. Reload vẫn giữ quantity/date/price/note.
3. Giữ 15.000 từ BV16 #12: shortage còn 10.000; giống bị khóa; cây còn bán giảm đúng.
4. Thử giảm đơn xuống 10.000: “Đang giữ dư 5.000 cây”, CTA update disabled, không nhả nguồn. Đóng form quay lại đơn 25.000 với source 15.000 nguyên vẹn.
5. Lập chuyến dự kiến 5.000 từ source đó, chưa xác nhận xuất. Preview hủy đơn đúng 1 nguồn / 15.000 cây + 1 chuyến / 5.000 cây.
6. Xác nhận hủy rồi reload: order Đã hủy, không còn action edit/cancel/reserve/create shipment. Create/edit/reserve/plan/release/cancel history còn nguyên. Shipment detail Đã hủy vẫn có nguồn và 5.000 cây; nút quay lại đơn vẫn hoạt động.
7. Kiểm lại lô: stock phục hồi đúng như bảng dưới; giữ của đơn khác vẫn còn 10.000.

| Bước | Cây sống BV16 | Cây đủ bán | Tổng đang giữ trên lô | Cây còn bán |
| --- | ---: | ---: | ---: | ---: |
| Trước luồng | 45.200 | 32.000 | 10.000 | 22.000 |
| Giữ 15.000 + lên chuyến dự kiến | 45.200 | 32.000 | 25.000 | 7.000 |
| Sau hủy đơn | 45.200 | 32.000 | 10.000 | 22.000 |

Evidence local: `C:/Users/84387/.codex/visualizations/2026/10/08/01a118d2-9ada-77a1-9a4d-486bfcee630c/fc2-final/` gồm edit-conflict, cancel-preview, cancelled-history, planned-cancelled và stock-before/held/after ở 390px. Không commit ảnh vào repo.

## Quality gate và giới hạn bằng chứng

Local trên exact head đã duyệt: typecheck PASS, lint 0/0, **42 files / 376 tests PASS**, build PASS / PWA 14 entries. [Exact-head CI SUCCESS](https://github.com/17thedevv/VuonUomSo/actions/runs/37744639435), merge CI cũng xanh tất cả typecheck/lint/test/build. Nghiệm thu này dựa vào full CI merge cho gate tự động; không chạy lại full local khi mã web không đổi.

Browser trên demo local chứng minh core workflow và reload persistence; không phải field pilot với chủ vườn, không phải stress đa tab hoặc kiểm offline độc lập. Không khẳng định mọi workflow tương lai đã hoàn tất.

FC3 NEXT: `feat/fc3-reservation-reconciliation`. Chỉ mở branch sau FC2 closure; scope/contract reconciliation cần được chốt trước implementation. FC5 chưa bắt đầu.
