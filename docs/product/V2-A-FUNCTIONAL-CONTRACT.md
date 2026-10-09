# V2-A — Availability Read & Quick Update Functional Contract

Ngày: **09/10/2026**. **FROZEN FOR V2-A IMPLEMENTATION** theo quyết định roadmap của người dùng. Base merged `0d8d97a7254998ac84c7fedc087724f8ccc44da2`; không dựa vào FC5-1 chưa merge.

Authority: [FC0](../architecture/fc0-functional-contract.md), FC1–FC4 đã nghiệm thu, [V2 Roadmap](V2-ROADMAP.md). Contract này chỉ khóa read/composition; không tạo mutation, schema/index hoặc persisted identity mới. UI V2-A chưa được triển khai/nghiệm thu bởi tài liệu này.

## 1. Legacy variety grouping normalization

- Group key MUST là `variety.trim().toLowerCase()` như phép so giống hiện có. `" Monthong "` và `"monthong"` cùng nhóm. `"Ri 6"` và `"Ri6"` không tự gộp. Không xóa dấu tiếng Việt, fuzzy alias, collapse internal whitespace hoặc Unicode normalization mới để thay identity.
- Group chỉ là read projection. MUST giữ nguyên persisted variety labels, batch IDs, reservations/history; không tạo Product/Variant/SKU hoặc merge lô/nguồn.
- Display label lấy từ `variety.trim()` của batch có ID nhỏ nhất theo thứ tự chuỗi xác định; stable tie-break dùng existing ID. Group membership/ID không phụ thuộc sort/filter UI. Không randomize nhãn mỗi lần query.
- Search dùng cùng trim/lowercase cho tên giống và mã lô; substring match. Không fuzzy/accent folding trong slice này. Search/filter không thay eligibility so giống của reserve services.
- Derive nhóm từ toàn snapshot trước filter. Nếu tên giống khớp, hiển thị toàn nhóm; nếu chỉ mã lô khớp, vẫn giữ totals của toàn nhóm và đánh dấu `matchedBatchIds` cho đúng leaf. Hero ghi rõ **Tổng vườn**, không biến thành tổng search results. Không giấu nghĩa của totals khi tìm một mã lô.
- Default `Cây còn bán` chọn nhóm có aggregate available > 0; `Tất cả` gồm nhóm available=0. Nhóm có available và shortage cùng lúc vẫn hiện warning. Drill-down luôn thấy các lô và trạng thái riêng, kể cả lô thiếu; không thay nguồn tự động.
- Missing/empty variety hoặc quantities sai trên dữ liệu cần derive: query báo lỗi cần kiểm tra, không tạo nhóm “hàng khác”, bỏ record âm thầm hoặc cho tổng giả. Đây là fail-closed read; không sửa DB tự động.

## 2. Coherent IndexedDB read snapshot

Garden query MUST đọc batches và reservations trong **một Dexie `r` transaction** có đủ cả hai tables; sau đó derive bằng canonical domain helpers từ facts đã capture trong transaction. Không ghép kết quả từ hai root reads độc lập (`Promise.all` ngoài transaction không tạo snapshot).

Nếu bổ sung facts của table khác vào DTO, table đó MUST thuộc cùng read transaction. Không đưa contacts/orders/shipments vào query chỉ để dựng tính năng ngoài scope. UI gọi query service, không join trực tiếp IndexedDB hoặc dựng stock cache riêng.

DTO là view tạm thời, tối thiểu:

```text
GardenAvailabilityView
  basis: legacy_variety
  capturedAt: thời điểm view local được tạo
  ownTotals: living / ready / outstanding / available / commitmentShortage
  groups[]:
    key / label / batchIds / matchedBatchIds
    totals: các đại lượng derive theo lô
    batches[]: batch ID, mã/giống, các đại lượng derive theo lô
```

`capturedAt` không phải thời điểm kiểm kê gần nhất, sync time hoặc bằng chứng tồn mới ngoài thực địa. Snapshot đang hiển thị không phải authorization để reserve: service mutation hiện có vẫn re-read current authority tại commit.

Writer thay batch + reservation trong một transaction: query thấy toàn bộ before hoặc toàn bộ after, MUST NOT thấy hybrid. Có real Dexie regression cả hai thứ tự, không chỉ mock repository trả array.

Reload sau mutation và khi trở lại Garden lấy snapshot mới; giữ search/view hợp lệ. Nếu request cũ hoàn thành sau request mới, MUST NOT ghi đè view mới. Query failure không trình bày stale totals như đã reload thành công; cho retry và phân biệt số cũ nếu còn hiển thị. Query/search/filter MUST NOT write batch/order/reservation/event nghiệp vụ.

## 3. Cây còn bán = available, không phải ready

| UI label | Canonical authority theo lô |
|---|---|
| Cây còn sống | `Batch.currentQuantity` (living) |
| Cây đủ bán | `Batch.readyQuantity` (ready) |
| Đang giữ | `reservedOutstandingQuantityForBatch()`; tổng O active chưa xuất |
| Cây còn bán | `availableQuantityForBatch()` |
| Thiếu cây đã giữ | `commitmentShortageForBatch()` |

Reuse helpers trong `web/src/domain/quantity.ts` và `remainingReservationQuantity()`; không đặt một công thức UI riêng trong JSX. O active = Q−F; fulfilled/released có O=0. C coverage của đơn là đại lượng khác: active/fulfilled đóng góp Q, released đóng góp F; không cộng C vào Đang giữ của lô.

Per-batch authority: available = max(ready−O,0), shortage = max(O−ready,0). Group/own totals MUST cộng từng metric **đã derive ở từng lô**. MUST NOT lấy max(sum ready−sum O,0), net shortage với cây dư khác lô hoặc auto-transfer commitment.

Own totals chỉ gồm batches nội bộ và commitments liên quan; supplier contact/external commitment không phải own stock. Active external O có thể được đọc ở order/customer flow nhưng không làm tăng/giảm Garden own availability.

Quantities và tổng phải hữu hạn, nguyên an toàn, không âm; ready≤living giữ theo authority hiện có. O>ready là shortage hợp lệ, không phải corruption. Query không clamp corruption thành “hết cây”. Các max trong helper biểu diễn shortage hợp lệ, không thay guard dữ liệu lỗi.

### Fixture bắt buộc

Hai lô cùng normalized variety, đơn vị **cây**:

| Lô | Ready | O | Available | Shortage |
|---|---:|---:|---:|---:|
| A | 15 | 18 | 0 | 3 |
| B | 20 | 5 | 15 | 0 |
| Tổng nhóm | 35 | 23 | **15** | **3** |

Hero/group/card/drill-down phải khớp. **Available 12 là FAIL**. Fixture vẫn phải đúng khi scale ×1000, sau một snapshot update hợp lệ và khi O có partial F/released history; không dùng historical Q thay O.

## 4. Quick update và integration giữ authority cũ

QuickUpdateChooser chỉ compose chọn batch ID → **Kiểm kê số sống**, **Cập nhật cây đủ bán**, **Thêm lô mới** qua flows hiện có. Context lô có sẵn bỏ bước chọn lô. Không tạo delta loss/move/restock/size/condition/photo command.

Existing preview before/after living/ready/available/shortage và ready≤living guard MUST còn nguyên. Shortage thật không chặn lưu chỉ vì thiếu cam kết. Existing mutation/Undo/history/backup semantics không bị refactor để thêm Garden.

Garden → Ghi đơn chỉ prefill nhu cầu/giống đã validate; không auto-reserve batch. G10 custom variety phải được sửa trước acceptance Monthong. Today hero dùng own totalAvailable và link `/garden` khi route đã ship. Giữ bốn tab và existing batch/order/shipment URLs; không expose action close remaining từ branch FC5.

## 5. Acceptance và giới hạn bằng chứng

1. Normalization: case/trim; dấu/internal spaces không tự gộp; stable label/IDs; mã lô match vẫn có đầy đủ totals và đúng leaf.
2. Snapshot: transactional read/write interleaving; no writes; stale request không thay view mới; lỗi đọc không tạo zero totals.
3. Quantity: fixture 15/18 + 20/5; partial F/released O; external exclusion; invalid/non-finite/unsafe facts fail closed.
4. End-to-end: mở app → tổng còn bán → tìm Monthong → thấy lô → mở đúng lô → update → back → totals hiện trạng mới, filter giữ nguyên.
5. Browser 360/390/430/1280px, no overflow, accessible targets và keyboard viewport; existing core regressions/full CI xanh mỗi slice tích hợp.

Không schema/Product/Variant/Location/Size/payment/public URL/backend. Physical IME, PWA offline thực tế và product adoption phải kiểm trong pilot, không mặc định PASS từ automated/browser evidence. Bảng share/customer reads là V2-B riêng, C/D/E chỉ sau evidence.
