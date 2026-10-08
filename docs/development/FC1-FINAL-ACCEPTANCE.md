# FC1 — Final Acceptance

Ngày nghiệm thu: 08/10/2026. Phạm vi: Batch Stock Lifecycle; không triển khai C1 hoặc FC2.

## 1. Audit verdict

**PASS / FC1 DONE.** Review commit `e20b1c98e68405a86c3b11871165827c2c0d2b91` và toàn bộ diff FC1 so với main `0d20733fc369dddd987ac5cd9233100ab9c91416`.

Đã merge qua [PR #4](https://github.com/17thedevv/VuonUomSo/pull/4), merge commit `7eb4987fcf3ff949f5874107de67ed2bd89a1e19`. [CI trên merge commit](https://github.com/17thedevv/VuonUomSo/actions/runs/37709990216) SUCCESS ở tất cả quality gates. Checkout main chứa nguyên commit FC1; không có khác biệt mã web so với head đã review.

## 2. Findings by severity

- **BLOCKER / HIGH:** Không phát hiện lỗi ảnh hưởng số lượng tồn kho trong phạm vi FC1 đã review và các kịch bản đã kiểm tra. Không có required fix trước merge.
- **NOTE — UI cũ:** `ReserveQuantityModal.tsx` khởi tạo raw input bằng số cây nhưng truyền `unit="van"`. Khi mở giữ 32.000 cây, helper hiện 320.000.000 cây; nút xác nhận và reservation lưu thực tế vẫn là 32.000. Hai file liên quan không thay đổi trong FC1. Theo dõi patch UI riêng; không tự mở rộng C1 R01/R02.
- **NOTE — nội dung:** Nhật ký hoàn tác hiện fallback `mutation_undone`; các nhãn thiếu nguồn/còn phải xuất đã được UI Reference Study ghi nhận. Xử lý trong các patch có scope được duyệt.

## 3. Correctness, scope and architecture

- `updateBatchInventory` và `updateBatchReadyQuantity` đọc lại batch trong transaction `rw` trước validation phụ thuộc dữ liệu. Batch và event ghi atomic; yêu cầu ready mới rõ ràng khi living thấp hơn ready hiện tại. Input phải là số nguyên an toàn, hữu hạn, không âm; ready <= living <= initial.
- Undo inventory/ready kiểm tra cả expected living và expected ready bên trong cùng transaction rồi mới phục hồi và ghi event. Xung đột bị từ chối, không phục sinh tồn kho sau thay đổi khác. Snapshot Undo chỉ ghi sau khi transaction thành công.
- Giảm ready dưới outstanding commitment được lưu đúng thực tế; available chặn ở 0 và shortage hiển thị. Không dùng trạng thái lưu cũ để cấp quyền giữ cây; candidate dùng cây còn bán.
- Reservation không giảm living/ready. Lập chuyến không giảm tồn. Confirm shipment đọc lại các nguồn, giảm living và ready cùng fulfilled reservation trong transaction; trạng thái lô được derive lại. Tests bảo vệ idempotency, rollback nhiều dòng và metadata nguồn.
- FC0 giữ nguyên authority semantics; không thêm lifecycle sửa/hủy đơn, reconciliation, cloud/auth hay tính năng từ sản phẩm tham khảo. UI gọi service; công thức quantity nằm ở domain.

## 4. Verification commands run

Chạy từ `web/` trên exact head `e20b1c9`:

| Gate | Kết quả |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS — 38 files, 299 tests |
| `npm run build` | PASS |

Build có cảnh báo chunk >500 kB; test có thông báo jsdom navigation không hỗ trợ, không làm fail gate. Không sửa cấu hình để bỏ qua cảnh báo.

Remote full gates: [push exact head](https://github.com/17thedevv/VuonUomSo/actions/runs/37705235381), [PR exact head](https://github.com/17thedevv/VuonUomSo/actions/runs/37709820352), và [merge main](https://github.com/17thedevv/VuonUomSo/actions/runs/37709990216) đều SUCCESS.

Tests đã review có assertions về ready tăng/giảm, factual shortage, coupled inventory, input NaN/Infinity, stale Undo, trạng thái depleted và reservation candidate với stored status cũ. Các test interleaving mô phỏng thay đổi tuần tự; không coi chúng là bằng chứng stress concurrent đa tab.

## 5. Mobile core workflow

Thực hiện qua UI thật ở viewport 390 × 844, origin local riêng `127.0.0.1:5183`, sổ kiểm thử trống, không dùng dữ liệu vườn hiện có.

| Bước | Living | Ready | Outstanding giữ | Còn bán |
| --- | ---: | ---: | ---: | ---: |
| Tạo lô BV16 | 50.000 | 0 | 0 | 0 |
| Cập nhật ready | 50.000 | 32.000 | 0 | 32.000 |
| Đơn 50.000, giữ 32.000 | 50.000 | 32.000 | 32.000 | 0 |
| Lập chuyến 10.000 | 50.000 | 32.000 | 32.000 | 0 |
| Xác nhận xuất 10.000 | 40.000 | 22.000 | 22.000 | 0 |
| Trên main: tăng ready | 40.000 | 40.000 | 22.000 | 18.000 |
| Giữ thêm 18.000 | 40.000 | 40.000 | 40.000 | 0 |
| Xuất 40.000 qua hai khoản giữ cùng lô | 0 | 0 | 0 | 0 |

Đơn kết thúc 50.000/50.000 đã giao, lô “Đã hết”; core workflow đã kiểm tra không có dead-end. Reload giữ đúng dữ liệu sau xuất và Undo.

Kiểm tra bổ sung trước bước tăng ready: giảm ready xuống 20.000 khi giữ 22.000 tạo cảnh báo thiếu 2.000 nhưng vẫn lưu được; Undo phục hồi 22.000. Kiểm kê living 18.000 bị khóa lưu khi thiếu ready mới; nhập ready 17.000 lưu được cả hai, báo thiếu cam kết 5.000; Undo phục hồi living 40.000 / ready 22.000.

Ảnh bằng chứng lưu ở thư mục artifact local `fc1-acceptance` trong chat; không commit ảnh vào repo. Đây là kiểm thử local và review code, chưa thay thế field pilot.

## 6. Next scope

FC2 NEXT trong roadmap, chưa bắt đầu. Task 02 là C1 R01/R02 đã duyệt trước FC2; không redesign cả app. UI Reference Study v0.1 giữ trạng thái RESEARCH APPROVED / IMPLEMENTATION PENDING.
