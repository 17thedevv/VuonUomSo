# Product Expansion Thesis — từ Vườn Ươm tới “sổ hàng có cam kết”

Ngày: 08/10/2026. Trạng thái: **STRATEGIC HYPOTHESIS / NOT A ROADMAP CHANGE**.

Tài liệu này ghi lại hướng mở rộng sản phẩm dài hạn sau trao đổi sản phẩm. Nó **không thay đổi scope FC3–FC6**, không cho phép generalize code sớm và không đổi tên sản phẩm hiện tại.

## 1. Quyết định hiện tại

- **Vertical đang phục vụ:** nhà vườn/cơ sở cây giống.
- **Tên sản phẩm hiện tại:** **Vườn Ươm**.
- **Descriptor hiện tại:** **Sổ cây giống trên điện thoại**.
- **Wedge để validation:** giải quyết thật tốt nghiệp vụ cây giống trước khi mở rộng.
- **Product thesis dài hạn:** có thể trở thành một **sổ hàng trên điện thoại cho người bán nhỏ có hàng phải giữ trước, gom nguồn và xuất sau**.
- Thesis này là giả thuyết cần kiểm chứng, **không phải requirement để đổi model/domain hiện tại**.

## 2. Giá trị cốt lõi đang được kiểm chứng

Điểm mạnh hiện tại không phải “quản lý bán hàng” nói chung. Vườn Ươm tập trung trả lời bốn câu hỏi vận hành:

1. **Còn bao nhiêu hàng thực sự có thể bán?**
2. **Đã giữ bao nhiêu và giữ cho ai?**
3. **Đang thiếu nguồn nào để đáp ứng cam kết?**
4. **Còn hàng/chuyến nào chưa thực sự xuất?**

Trong cây giống, bốn câu hỏi này hiện được biểu diễn bằng lô cây, cây sống, cây đủ bán, giữ cây, nguồn cung và chuyến xuất.

Giả thuyết mở rộng là: nhiều nhóm bán nhỏ khác cũng có cùng bài toán **commitment trước fulfillment**, dù đối tượng hàng hóa khác nhau.

## 3. Phần có khả năng dùng chung và phần riêng của cây giống

### 3.1. Candidate generic core — chỉ là khái niệm

Nếu sau này nhiều vertical thật sự dùng cùng workflow, phần chung có thể tương ứng với:

- Hàng/sản phẩm cần đáp ứng.
- Nguồn cung.
- Đơn/nhu cầu khách.
- Cam kết giữ hàng.
- Lượng còn có thể bán.
- Thiếu nguồn so với cam kết.
- Điều phối/chuyển nguồn.
- Fulfillment/xuất hàng.
- Lịch sử điều chỉnh và các guard chống ghi đè/bán khống.

**Không đổi tên entity/code hiện tại sang generic chỉ vì tài liệu này.** Generic core chỉ được tách sau validation đa vertical.

### 3.2. Nursery-specific module

Các khái niệm dưới đây hiện là nghiệp vụ riêng của cây giống:

- Cây còn sống.
- Cây đủ bán.
- Lifecycle lô ươm.
- Giống cây.
- Hao hụt/chết cây/kiểm kê sinh học.
- Hồ sơ nguồn gốc cây giống.
- Các thuật ngữ và thao tác chuyên ngành vườn ươm.

Không được làm yếu các semantics này để “phù hợp mọi ngành” trong prototype hiện tại.

## 4. Vertical mở rộng nên được chọn theo workflow similarity

Không mở rộng vì một ngành “cũng bán hàng”. Chỉ ưu tiên vertical có hành vi gần với workflow hiện tại.

### 4.1. Nhóm đáng nghiên cứu sau field pilot

Các ví dụ ban đầu, **chưa phải thị trường đã được xác nhận**:

- Cây cảnh.
- Hoa.
- Hàng đặt trước cần gom từ nhiều nguồn.
- Nhóm hàng nhỏ lẻ có cam kết trước khi giao và có thể giao/xuất từng phần.

### 4.2. Dấu hiệu một vertical phù hợp

Một vertical càng phù hợp nếu có nhiều đặc điểm sau:

- Người bán thường **nhận nhu cầu trước khi fulfillment**.
- Hàng đã có thể bị **giữ/cam kết cho khách** trước khi rời kho.
- Nguồn hàng phân tán hoặc phải gom từ nhiều nguồn.
- Có tình huống thiếu nguồn sau khi đã nhận cam kết.
- Có đổi số lượng, nhả/chuyển nguồn hoặc giao từng phần.
- Người vận hành chủ yếu dùng điện thoại và không muốn ERP nặng.
- Giá trị lớn nhất là tránh hứa quá số có thể đáp ứng và biết việc nào cần xử lý tiếp.

### 4.3. Nhóm không nên nhắm tới chỉ để “mở rộng”

Nếu vấn đề chính của nhóm là:

- POS tại quầy.
- Thanh toán.
- Hóa đơn.
- Khuyến mãi.
- SKU catalog lớn.
- Kế toán/công nợ.
- Loyalty/CRM.

thì Vườn Ươm hiện không có lợi thế rõ và sẽ bị kéo sang cạnh tranh trực tiếp với phần mềm bán lẻ tổng quát.

## 5. Quy tắc generalize

**Không generalize vì “có thể dùng cho ngành khác”.**

Chỉ cân nhắc tách generic core khi có bằng chứng từ **ít nhất 2–3 vertical thực tế** rằng họ dùng cùng workflow và cùng các invariant quan trọng.

Bằng chứng cần ưu tiên:

- Cùng câu hỏi “còn bán / đã giữ / thiếu nguồn / chưa xuất”.
- Cùng nhu cầu điều chỉnh cam kết mà không phá tồn vật lý.
- Cùng nhu cầu multi-source hoặc partial fulfillment.
- Cùng các failure mode mà hiện tại FC0–FC5 đang bảo vệ.
- Người dùng hiểu và dùng được workflow mà không cần ép họ theo ngôn ngữ cây giống.

Nếu chỉ giống nhau ở CRUD đơn hàng/tồn kho, chưa đủ lý do để generalize.

## 6. Guardrail kiến trúc

Trong roadmap hiện tại:

```text
FC3 → FC4 → FC5 → FC6 → FIELD PILOT CÂY GIỐNG
```

Agent **không được** vì thesis này mà:

- đổi `Batch` thành generic inventory entity;
- đổi `Reservation`/shipment/domain model sang framework đa ngành;
- tạo abstraction “Product/SKU” chưa có use case thật;
- thêm POS/payment/accounting;
- đổi vocabulary cây giống đang được người dùng pilot;
- đổi schema để phục vụ vertical chưa được validation.

Sau field pilot mới mở một track riêng:

```text
PRODUCT EXPANSION DISCOVERY
→ chọn 2 vertical gần nhất
→ mapping workflow thật
→ so sánh invariant
→ prototype ngôn ngữ/nghiệp vụ
→ quyết định có generic core hay không
```

Track này không tự động nằm trong FC roadmap.

## 7. Naming decision — chưa đổi tên

### Quyết định hiện tại

**Giữ tên “Vườn Ươm”. Chưa rename repo/app/domain.**

Lý do:

1. Sản phẩm hiện vẫn đang validation với cây giống.
2. Tên hẹp giúp định vị rõ với nhóm khách đầu tiên thay vì trở thành một app bán hàng chung chung.
3. Chưa có bằng chứng rằng vertical thứ hai thực sự dùng sản phẩm.
4. Rename sớm sẽ tạo chi phí UI/docs/brand mà không làm tăng độ đúng của core workflow.
5. Một tên generic có thể làm mất lợi thế “phần mềm hiểu đúng nghề của tôi”.

Cụm **“sổ hàng trên điện thoại cho người bán nhỏ có hàng phải giữ trước, gom nguồn và xuất sau”** hiện là **category/product thesis nội bộ**, không phải tên brand.

### Khi nào mới mở naming review

Chỉ mở lại quyết định đặt tên sau khi:

- field pilot cây giống đã có tín hiệu sử dụng thật;
- đã nghiên cứu ít nhất hai vertical lân cận;
- có bằng chứng workflow chung đủ mạnh để đáng generalize;
- tên “Vườn Ươm” thực sự gây cản trở khi thử vertical ngoài cây giống.

Khi đó mới đánh giá ba hướng:

1. **Giữ Vườn Ươm** nếu cây giống vẫn là thị trường chính.
2. **Tạo umbrella brand**, giữ Vườn Ươm như vertical/product chuyên ngành.
3. **Rename toàn sản phẩm** nếu generic workflow đã trở thành sản phẩm chính và tên cũ tạo friction rõ ràng.

Không chọn phương án trước khi có evidence.

## 8. Hướng positioning cần bảo vệ

Không positioning là:

> “Phần mềm quản lý bán hàng cho mọi loại hàng.”

Candidate positioning để nghiên cứu về sau:

> **Sổ hàng cho người bán nhỏ có hàng phải giữ trước, gom nguồn và xuất sau.**

Trong pilot hiện tại, câu nói với người dùng vẫn nên cụ thể theo cây giống:

> **Vườn Ươm — Sổ cây giống trên điện thoại.**

## 9. Điều kiện để thesis này thay đổi roadmap

Tài liệu này chỉ chuyển từ strategic hypothesis thành roadmap khi người dùng chủ dự án quyết định mở **Product Expansion Discovery** sau pilot.

Cho tới thời điểm đó:

- FC3–FC6 giữ nguyên.
- FC4/FC5 không được generalize vì thesis.
- Vườn Ươm vẫn là brand chính thức.
- Cây giống vẫn là vertical validation duy nhất.
