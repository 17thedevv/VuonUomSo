# FC3-0 — Reservation Reconciliation Contract

Ngày: 08/10/2026. **DRAFT / REVIEW PENDING — DOCUMENTATION ONLY.**

Base: `main = 0283ea49e3e5453ca9f64bbb9f61ae3ebeac2dc7`; FC2 DONE. Branch: `feat/fc3-reservation-reconciliation`.

Tài liệu cụ thể hóa đề xuất FC3 của người dùng và đối chiếu [FC0](../architecture/fc0-functional-contract.md), [FC2 Final Acceptance](FC2-FINAL-ACCEPTANCE.md) cùng model hiện tại. Chưa cho phép viết service/UI reconciliation. FC3-0 chỉ CLOSED sau khi contract được nghiệm thu và merge; FC3 overall chưa DONE.

## 1. Mục tiêu và hai trigger

Chủ vườn chọn chính xác cam kết nào giảm/nhả/chuyển khi nhu cầu hoặc nguồn cây thay đổi. Hệ thống không tự chọn khách chịu thiếu, không sửa tồn vật lý và không làm mất phần đã xuất hoặc sửa các chuyến xe.

| Trigger | Ví dụ | Hành vi |
| --- | --- | --- |
| A — Giảm số đặt dưới coverage | Muốn 25.000, đang có nguồn 32.000: dư 7.000 | Chọn rõ reservation giảm/nhả; lưu số đặt mới và nguồn trong cùng transaction |
| B — Lô thiếu cây đã giữ | Ready 15.000, outstanding 18.000: thiếu 3.000 | Liệt kê đúng các cam kết trên lô; chọn khách giảm/nhả hoặc chuyển sang lô cùng giống |

Không nâng ready ngược lên cho hết thiếu; không tự release hoặc ưu tiên một khách. Trigger B không tự sửa số đặt của các đơn bị ảnh hưởng.

## 2. Đại lượng và lịch sử reservation

Dùng đúng helpers hiện tại, không viết công thức riêng trong UI:

| Đại lượng | Contract |
| --- | --- |
| `fulfilledQuantity` (F) | Số thực sự đã xuất của record; FC3 giữ nguyên, mặc định 0 khi thiếu field theo model hiện tại |
| `quantity` (Q) | Tổng cam kết của record tại phiên bản đang lưu, gồm phần đã xuất; quantity ban đầu và các lần sửa được giữ trong events |
| Outstanding (O) | `remainingReservationQuantity`: active = max(Q − F, 0); released/fulfilled = 0 |
| Coverage đơn (C) | `coveredQuantityForReservation`: active/fulfilled = Q; released = F; cộng mọi nguồn của đơn bằng `reservedQuantityForOrder` |
| Thiếu nguồn đơn | max(requested − C, 0), theo `orderShortage`; không phải Còn phải xuất |
| Còn phải xuất | max(requested − tổng completed shipments, 0); planned/cancelled không tính đã xuất |
| Còn bán lô | max(ready − tổng O active trên lô, 0), theo `availableQuantityForBatch` |
| Thiếu cây đã giữ trên lô | max(tổng O active trên lô − ready, 0), theo `commitmentShortageForBatch` |

UI hỏi **“Sau điều chỉnh còn giữ bao nhiêu cây?”**, dùng số tuyệt đối O mới, không yêu cầu người dùng tính delta. Ví dụ đang giữ 12.000 → còn giữ 7.000. Tất cả số lượng và tổng trung gian phải là số nguyên an toàn, hữu hạn; không âm. Requested và lượng chuyển mới phải > 0.

Chỉ điều chỉnh reservation active có O > 0. `0 <= newOutstanding <= currentOutstanding`; Q sau điều chỉnh không bao giờ nhỏ hơn F. Không tăng một record cũ bằng thao tác giảm. Record released/fulfilled không được tái kích hoạt hoặc sửa lại phần đã xuất.

### Quyết định biểu diễn cần duyệt ở FC3-0

| Kết quả | Quantity lưu | Status | Phần đã xuất / coverage |
| --- | --- | --- | --- |
| Còn giữ O mới > 0 | Q mới = F + O mới | active | F nguyên vẹn; coverage = F + O mới |
| Nhả toàn bộ O, F = 0 | Giữ Q dương ngay trước thao tác | released | O = 0, coverage = 0 |
| Nhả toàn bộ O, F > 0 | Giữ Q dương ngay trước thao tác | released | O = 0, coverage = F; shipment/fulfilled history nguyên vẹn |
| Record đã fulfilled trước thao tác | Không đổi | fulfilled | Không phải đối tượng giảm/chuyển |

Nhả phần chưa xuất không được giả thành đã xuất: không đặt `fulfilledQuantity = quantity`, không đổi record thành fulfilled chỉ vì O mới = 0. Không xóa record. Khi full release, status quyết định O = 0; không áp công thức max(Q − F, 0) bỏ qua status.

Ngoại lệ full release giữ Q dương để tương thích model/release hiện có và `backup.validate.ts`, vốn yêu cầu Q > 0 với mọi reservation. Không lưu Q = 0, không thay backup/schema chỉ để diễn đạt “còn giữ 0”. Events before/after ghi cả Q/F/status và O trước/sau; original creation history không bị sửa. Đây là quyết định contract, chưa là code đã triển khai.

### Backup compatibility — yêu cầu bắt buộc khi implementation

Backup validation **MUST allow `activeOutstanding > readyQuantity`**. Đây là trạng thái thiếu cây đã giữ hợp lệ theo FC0 và FC3, kể cả shortage còn lại sau partial reconciliation, **không phải corruption**. `backup.validate.ts` trên base `0283ea49` hiện từ chối trạng thái này; implementation FC3 **MUST loại bỏ invariant backup cũ `activeOutstanding <= readyQuantity` mâu thuẫn với FC0** trước khi nghiệm thu backup/restore. Không coi validator hiện tại đã đáp ứng acceptance này.

Validator **MUST giữ** `Q > 0`, `0 <= F <= Q`, status semantics, referential integrity, planned-shipment allocation integrity và các invariant hợp lệ khác (gồm `ready <= living <= initial`, coverage đơn <= requested, completed shipment/fulfillment integrity). Cho phép shortage khi restore không cấp quyền tạo thêm cam kết vượt available; guard giữ/chuyển nguồn tại commit vẫn giữ nguyên. FC3 không đổi schema/format chỉ để biểu diễn shortage, không tự nâng ready hoặc giảm/nhả reservation khi restore. Backup/restore phải bảo toàn state, shortage và history đúng như đã lưu.

## 3. Ranh giới đơn đã xuất và giảm đơn atomic

**Giảm requestedQuantity chỉ trước khi xuất**, giữ FC0 điều 6 và guard FC2: completed shipment, fulfilled history hoặc stored shipped/partially_shipped đều khóa sửa số đặt; không dùng FC3 để né guard. Khi đơn đã xuất một phần, Trigger B có thể giảm/chuyển O chưa xuất của active reservation, giữ requested và lịch sử xuất nguyên vẹn. Không tự đánh cancelled/closed_remaining; dừng phần còn lại thuộc FC5.

Trigger A nhận một số đặt mong muốn và danh sách reservation của đúng đơn do người dùng chọn. Không sửa variety/date/price/note trong reconciliation. Fields không nằm trong intent giữ current value; field/history thay đổi sau preview phải xem lại theo mục 8.

Một transaction đọc current state → validate toàn kế hoạch → giảm/nhả reservations → ghi requested mới → tính lại status → append history. Không buộc người dùng nhả nguồn trước rồi quay lại sửa đơn. Không gọi hai mutation độc lập để giả atomic.

Postcondition: `coveredAfter <= requestedAfter`. Không bắt coverage bằng requested; coverage ít hơn tạo shortage thật. Nếu chưa giảm đủ nguồn, trả conflict với lượng dư còn lại, không ghi bất kỳ field nào. Không tự giảm nguồn còn thiếu trong kế hoạch.

| Requested trước | Nguồn trước | User chọn | Requested sau | Coverage sau | Thiếu nguồn |
| ---: | --- | --- | ---: | ---: | ---: |
| 50.000 | BV16 20.000 + ngoài 12.000 | BV16 còn 15.000, ngoài còn 10.000 | 25.000 | 25.000 | 0 |
| 50.000 | Tổng 32.000 | Chọn giảm tổng xuống 22.000 | 25.000 | 22.000 | 3.000 |
| 50.000 | Tổng 32.000 | Chỉ giảm xuống 28.000 | Không lưu | Không lưu | Conflict dư 3.000 |

Status tính từ post-state: chưa xuất và C=0 → open; 0<C<requested → partially_reserved; C=requested → reserved. Trigger B trên đơn đã xuất một phần giữ partially_shipped theo bằng chứng shipment/fulfillment; không hạ xuống open vì nguồn giảm. Đơn cancelled hoặc đã xuất đủ không được reconciliation. Dữ liệu shipment/fulfillment mâu thuẫn thì trả conflict, không tự sửa lịch sử hoặc giảm F.

## 4. Chuyển nguồn nội bộ

FC3 chỉ cho **own batch A → own batch B**, cùng order và cùng giống chuẩn hóa trim/lowercase của đơn/A/B. A và B phải khác nhau; B tồn tại, cây còn bán tại commit > 0 và >= tổng lượng mới vào B trong kế hoạch. Batch status không phải authority. Không lấy availability ở preview làm quyền giữ.

User chọn source reservation, target batch và lượng chuyển T. `T > 0`, `T <= O trước − O sau`; phần giảm còn lại, nếu có, là release được preview rõ. Giảm commitment A và tạo reservation active mới tại B (Q=T, F=0) atomically. Giữ ID/source/order/createdAt của record A; không đổi batchId của record có shipment history, không chuyển phần đã xuất sang B, không gộp vào record cũ tại B. Event liên kết source/target record IDs.

Chuyển T không tăng coverage đơn: phần T giảm tại A và tạo tại B phải bằng nhau. Target validation cộng tất cả allocations vào cùng B; không kiểm từng dòng độc lập khiến tổng vượt available. B dùng current availability trước những allocations mới; không lấy dự kiến nhả từ dòng khác để giả thêm nguồn. Không cho chuỗi/vòng chuyển nguồn trong một kế hoạch đầu tiên.

Ví dụ hợp lệ: BV16 #12 → BV16 #13 nếu cùng giống và còn bán đủ. Ví dụ “BV16 #12 → AH1 #04” chỉ là minh họa nhãn trong đề xuất, **không được cho qua nếu thực tế là hai giống khác nhau**.

Không tạo external commitment mới từ catalog estimate trong FC3; không có own → external, external → own hoặc external → external transfer. Existing external reservation được giảm/release trong Trigger A; B chỉ liệt kê own reservations trên chính lô thiếu. New external commitment và supplier truth thuộc FC4. API giữ nguồn ngoài cũ không phải lối đi tắt của reconciliation.

## 5. Planned shipment hard guard và completed immutable

Với mỗi reservation, tính P là tổng lượng line tham chiếu record trong **mọi planned shipments** liên quan. Dù hiện tại chỉ cho một chuyến planned/đơn, không chỉ kiểm một line đầu tiên.

Postcondition: `newOutstanding >= P`. Ví dụ O=15.000, P=10.000: còn giữ 12.000 được phép; còn giữ 5.000 hoặc release hết bị chặn. Guard áp dụng cả release và transfer tại nguồn A. Không cancel/resize/reassign planned shipment line ngầm; mọi line/quantity/date/status của chuyến giữ nguyên.

Thông báo: “10.000 cây của nguồn này đang nằm trong chuyến chờ xuất. Hãy hủy chuyến đó trước khi giảm nguồn giữ xuống 5.000 cây.” Có ID/link **XEM CHUYẾN CHỜ XUẤT** và đường quay lại; hủy chuyến là hành động hiện có, ngoài transaction reconciliation, sau đó preview lại.

Completed shipment, lines, shippedQuantity và shippedAt tuyệt đối immutable. Shipment completed từ sau preview làm kế hoạch stale, không tự chuyển intent sang current F mới. Chỉ người dùng xem lại mới gửi kế hoạch mới cho O còn lại.

Legacy planned shipment không có lines hoặc dữ liệu phân bổ không xác minh được: trả conflict chỉ rõ chuyến cần xem/hủy, không giả P=0 rồi cho giảm cam kết. FC3 không sửa dữ liệu shipment legacy trong transaction này.

## 6. Batch shortage và partial reconciliation

Trigger B liệt kê active own-batch reservations **trên chính batch đang thiếu**: order/customer, O hiện tại, P đang nằm trong chuyến chờ, F để giải thích phần đã xuất. Không cộng external reservations vào thiếu lô.

Ready 15.000, Chị Lan O=10.000, Anh Hùng O=8.000: tổng giữ 18.000, thiếu 3.000. User chọn Lan giảm 3.000 hoặc chuyển 3.000 sang lô đủ điều kiện; không tự áp FIFO hay phân bổ tỷ lệ.

**Cho phép xử lý một phần**: nếu chỉ giảm/chuyển 1.000 thì lưu toàn kế hoạch atomic, còn thiếu 2.000 và UI phải hiện “Đã điều chỉnh, lô còn thiếu 2.000 cây đã giữ”. Không báo đã xử lý xong. Hoàn tất khi `commitmentShortageAfter = 0`. Partial hợp lệ phải thực sự giảm shortage; no-op không tạo event thành công giả. Có thể giảm nhiều hơn lượng thiếu nếu user chọn rõ và thấy shortage của đơn tăng tương ứng.

Postconditions: shortage source batch không tăng; không tạo shortage mới trên target; order coverage không vượt requested; toàn bộ planned lines vẫn được O bao phủ. Không giảm requested để che thiếu nguồn của khách. Chỉ sửa selected reservations; các nguồn/đơn khác được đọc để validate/tính tổng nhưng không tự giảm chúng. Status recompute chỉ trên các orders thực sự bị ảnh hưởng.

## 7. Preview, ghi lịch sử và Undo

Preview cần cho người dùng thấy trước xác nhận:

- Nguồn/khách nào bị giảm/nhả/chuyển; O trước/sau, lượng nhả và lượng chuyển, target.
- Số đặt/coverage/thiếu nguồn mỗi đơn trước/sau; requested chỉ thay trong Trigger A.
- Ready, tổng đang giữ, còn bán, thiếu cây đã giữ của source/target lô trước/sau; living/ready không đổi.
- Chuyến chờ xuất đang dùng nguồn và conflict nếu có; completed không thay đổi.

Không dùng thuật ngữ transaction/fingerprint/reservation trong copy cho chủ vườn. Input cây/vạn dùng parser hiện có, invalid input không hiện projected numbers sai. Đóng preview không ghi dữ liệu; lỗi giữ input và cho xem lại. Không sweep layout.

Append events cùng transaction vào bảng events hiện có: intent/trigger, operationId, before/after order và selected reservations, F/Q/O/status, reductions/releases/transfers, source/target IDs, coverage/shortage before/after. Order timeline và batch timeline của cả nguồn/đích phải truy được cùng thao tác. Giữ creation/completed history; không event sourcing, replay state hay thêm bảng audit mới.

Copy dùng O: “Đã điều chỉnh nguồn giữ BV16 #12: còn giữ 15.000 → 10.000 cây”; “Đã chuyển 5.000 cây: BV16 #12 → BV16 #13”; “Đã giảm đơn: 50.000 → 25.000 cây. Nguồn giữ: 32.000 → 25.000 cây”. Khi F>0, ghi rõ đã xuất F không đổi, không gọi phần release là đã xuất.

Không thêm Undo reconciliation ở FC3 đầu tiên. Sau thành công, stale Undo không được xóa/phục hồi record đã reconciliation; các guards create-order/create-reservation cũ phải nhận biết history và current state mới trước implementation handoff. Không thay rollback an toàn bằng Undo sau commit.

**Required implementation task:** harden `create_reservation` Undo, hiện còn gọi release trực tiếp trên base, để từ chối Undo cũ khi record đã reconciliation; không được nhả lại cam kết sau điều chỉnh/chuyển. Bắt buộc regression real service kiểm tra Undo cũ không đổi nguồn, coverage, history hoặc stock sau reconciliation. Đây là gate implementation, không phải một Undo reconciliation mới.

## 8. Transaction, stale intent và idempotency

Read orders bị ảnh hưởng → reservations của orders và source/target batches → source/target batch facts → planned/completed shipments → validate current state và intent → mutate → append events, **trong một Dexie rw transaction** bao phủ orders/reservations/batches/shipments/events (contacts chỉ khi cần snapshot nhãn). UI preview ngoài transaction không cấp quyền mutate. Living/ready của mọi batch giữ nguyên; không ghi snapshot batch cũ ngược lên.

Kế hoạch có expected snapshot/fingerprint của các facts được preview: orders/selected records, coverage, source shortage, target availability, related planned/completed allocations. FC3 dùng xác nhận optimistic cho kế hoạch nhiều entity: **không dùng semantics last intentional edit wins của form FC2** để bỏ qua thay đổi sau preview. Metadata order thay đổi cũng yêu cầu refresh; không được gửi snapshot của các field không sửa để ghi đè current values.

| Thay đổi sau preview | Kết quả tại commit |
| --- | --- |
| Selected reservation quantity/F/status/source đổi hoặc vừa released | Conflict; không giảm tiếp từ snapshot cũ |
| Source/target inventory hoặc các cam kết khác làm coverage/availability/shortage đổi | Validate current totals; thiếu target thì conflict; preview facts đổi thì yêu cầu xem lại |
| Planned shipment xuất hiện/đổi line | Recheck P; chặn nếu O mới < P; dù còn đủ thì preview đổi cần xác nhận lại |
| Shipment vừa completed | Conflict; giữ shipment/F/stock mới, không rollback export |
| Order vừa cancel hoặc xuất đủ | Conflict; không phục sinh hoặc tạo cam kết |
| Requested/variety/metadata/status order vừa đổi | Conflict; không áp số đặt hoặc facts cũ |
| Event/write thất bại | Rollback toàn bộ; không có order/reservation/event ghi một phần |

Failure trả facts current và ID nguồn/chuyến xung đột để UI giải thích/refresh. Không tự điều chỉnh kế hoạch cho vừa, không ghi metadata trước rồi báo lỗi quantity.

Duplicate submit/retry cùng operationId không được giảm lần hai hoặc tạo target/event lần hai. Có thể đối chiếu operationId trong events hiện có bên trong transaction, không cần bảng mới. Nếu cùng ID nhưng intent khác thì conflict. Kế hoạch stale không được biến thành operation mới ngầm; no-op không thêm history. OperationId được cấp cho intent trước submit; dấu xác nhận đã áp dụng chỉ tồn tại sau commit thành công. Event-write failure phải cho retry an toàn. Chi tiết tên service/error enum thuộc implementation sau khi contract đóng, chưa khai báo API code trong FC3-0.

## 9. Acceptance matrix cho implementation sau FC3-0

| Case bắt buộc | Kết quả |
| --- | --- |
| Requested 50k, coverage 32k → chọn còn 25k, desired 25k | Atomic, requested=coverage=25k, stock không đổi |
| Cùng case → chọn coverage 22k | Lưu requested25k/coverage22k/shortage3k |
| Cùng case → coverage28k hoặc nguồn thuộc đơn khác | Không ghi; conflict |
| Partial active Q20k/F8k/O12k → O7k | Q15k/F8k active, coverage15k; shipment history không đổi |
| Cùng record → O0 | Released, Q dương giữ nguyên, F8k/coverage8k; backup restore hợp lệ |
| Chưa xuất, O12k → O0 | Released/coverage0, record/history còn; không Q0 |
| O15k/P10k → O12k vs O5k | Case đầu lưu không sửa line; case sau chặn, link đúng shipment |
| Source shortage3k → giảm/chuyển1k | Atomic partial, còn thiếu2k; không báo hoàn tất |
| Source shortage3k → giảm/chuyển3k | Shortage0; chỉ selected khách thay đổi |
| Own A→B đủ cây/cùng giống, nhiều dòng cùng target | T giảm và tạo đồng thời, tổng không vượt available, coverage không tăng |
| Target khác giống/cùng source/hết available/cyclic hoặc transfer từ/to external | Không ghi; conflict |
| Existing external giảm/release trước xuất | Lưu với coverage đúng, không đụng own stock |
| Trigger A trên đơn đã xuất một phần | Chặn requested edit theo FC0 |
| Trigger B trên active O của đơn đã xuất một phần | Chỉ O thay, requested/F/completed không đổi; không closed_remaining |
| Stale facts theo mục8, confirm shipment/cancel order/reconciliation interleaving | Re-read tại commit; không mất dữ liệu hay bán khống |
| Failure event/write + duplicate submit/retry | Rollback hoặc idempotent; không duplicate target/history |
| Backup/restore shortage hợp lệ: ready15k, O18k; partial reconciliation còn O17k | Cả state thiếu3k trước và thiếu2k sau đều validate/round-trip được, Q/F/status/stock/history giữ nguyên |
| Backup thiếu nguồn nhưng kèm Q0/F>Q/status sai/reference hỏng/planned allocation>O | Vẫn reject corruption; cho phép shortage không bỏ các integrity guards khác |
| Backup/restore + reload + stale Undo sau reconciliation | Bảo toàn status/Q/F/coverage/history, không xóa phần đã xuất |

Tests phải dùng domain assertions và real Dexie service integration, không chỉ mock UI message. FC3 final acceptance chạy cross-flow mobile 360–430px và kiểm stock/history trước/sau; chưa chạy hay viết tests reconciliation ở task docs này.

## 10. Roadmap và điều kiện đóng

| Slice | Phạm vi | Trạng thái |
| --- | --- | --- |
| FC3-0 | Review/khóa contract này | REVIEW PENDING, chưa CLOSED |
| FC3-1 | Order Reduction Reconciliation — domain/service atomic | Chờ FC3-0 đóng; chưa code |
| FC3-2 | Batch Shortage Reconciliation + own transfer | Chờ slice trước nghiệm thu; chưa code |
| FC3-3 | UI + Cross-flow Hardening | Chờ domain/service contract; chưa code |
| FC3 Final Acceptance | Full gates, mobile, stock/history/planned/export safety | Chưa bắt đầu; đạt mới FC3 DONE |

FC3-0 gate: người dùng duyệt các quyết định full-release/partial/after-shipment/stale intent và acceptance matrix; docs PR merged, PROJECT_STATE giữ phạm vi đúng. Không đánh CLOSED hoặc bắt đầu `reconcileReservation()` chỉ vì CI docs xanh.

Không bao gồm external supplier truth/new external commitment (FC4), closed_remaining (FC5), receipt/payment, shipment-line editing, cloud sync, CRM/accounting, redesign UI-R03/R04/R05. Không đổi FC0 authority hoặc shipment physical stock semantics.

## Tham chiếu model khi review

- `web/src/domain/reservation.ts`: remaining/covered helpers, active/fulfilled/released.
- `web/src/domain/quantity.ts`: availability/commitment shortage trên outstanding.
- `web/src/domain/order.ts`, `orderLifecycle.ts`: coverage và before-export edit guard.
- `web/src/domain/shipment.ts`, `web/src/services/shipmentService.ts`: planned allocation, completed/F authority.
- `web/src/services/reservationService.ts`: full-release giữ record; không coi mọi guard hiện tại đã đáp ứng contract mới.
- `web/src/data/backup/backup.validate.ts`: Q dương, F<=Q, status và shipment reference integrity.
- `web/src/analytics/events.ts`, `web/src/services/undoService.ts`: history hiện có và guards cần bảo vệ; không thêm event sourcing.
