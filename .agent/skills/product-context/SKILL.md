---
name: product-context
description: >-
  Use this skill to understand the product identity, target forestry users,
  business boundaries, capabilities model, current roadmap, and scope guardrails for Vườn Ươm.
---

# Product Context & Scope Discipline

## 1. Purpose

Định hướng cho agent hiểu bản chất sản phẩm **Vườn Ươm**, nhóm người dùng mục tiêu, ranh giới nghiệp vụ và kỷ luật phạm vi tính năng. Đảm bảo agent không tự suy diễn hoặc biến ứng dụng thành một hệ thống SaaS/ERP cồng kềnh.

---

## 2. When to Use & When NOT to Use

- **WHEN TO USE**:
  - Khi bắt đầu một task mới để hiểu bối cảnh bài toán.
  - Khi phân vân liệu một tính năng có nên được thêm vào hay không.
  - Khi định nghĩa hoặc chỉnh sửa luồng nghiệp vụ của người dùng (User flows).
  - Khi cần đối chiếu roadmap và giai đoạn triển khai hiện tại.
- **WHEN NOT TO USE**:
  - Khi giải quyết chi tiết CSS, styling, khoảng cách nút bấm (dùng `ux-design`).
  - Khi tính toán logic số lượng tồn kho hay đặt giữ cây (dùng `domain-rules`).
  - Khi thiết kế interface repository hay IndexedDB (dùng `architecture`).

---

## 3. Product Thesis

> **Vườn Ươm** là **Sổ cây giống trên điện thoại** — một công cụ ghi chép vận hành cực kỳ tinh gọn, thiết thực dành cho hệ sinh thái cây giống lâm nghiệp tại Việt Nam (khởi nguồn từ Hữu Lũng / Tuấn Sơn, Lạng Sơn).

### Sản phẩm này LÀ:
- Sổ tay số thay thế sổ giấy và trí nhớ của chủ vườn/thương lái.
- Công cụ trả lời ngay lập tức: *Còn bán được cây gì? Đã giữ cho ai? Khi nào xuất?*

### Sản phẩm này TUYỆT ĐỐI KHÔNG PHẢI LÀ:
- Một hệ sinh thái ERP nông nghiệp tổng quát.
- Một sàn thương mại điện tử (Marketplace) kết nối người mua kẻ bán công cộng.
- Một hệ thống kế toán/tính thuế. Quote/payment/debt tối thiểu chỉ là V2-D có điều kiện sau pilot, chưa được mở trong V2-A/B.
- Một mạng xã hội hay ứng dụng nhắn tin chat.
- Một nền tảng AI nông nghiệp chẩn đoán sâu bệnh qua ảnh.

---

## 4. Primary User Context

Người dùng mục tiêu của Vườn Ươm có các đặc điểm thực tế sau:

- **Thói quen số**: Rất ít hoặc chưa từng dùng phần mềm quản lý (ERP/SaaS), nhưng dùng Zalo hàng ngày rất thành thạo để nhắn tin, gửi ảnh bầu cây và chốt đơn.
- **Thiết bị**: Điện thoại thông minh Android phổ thông (màn hình 360px–430px), cấu hình vừa phải.
- **Môi trường sử dụng**: Thường xuyên đứng ngoài bãi ươm, vườn đồi, lội bùn, tay dính đất cát; thường chỉ cầm điện thoại bằng **một tay**.
- **Kết nối mạng**: Mạng 3G/4G yếu hoặc chập chờn khi ở đồi ươm; app phải luôn xem và ghi được ngay trên máy khi mất mạng.
- **Ngôn ngữ số lượng**: Luôn tư duy và trao đổi theo đơn vị **vạn** ($1\text{ vạn} = 10.000\text{ cây}$).

---

## 5. Organization Capability Model

Thay vì phân loại cứng người dùng thành `Nursery` (Chủ vườn) hoặc `Trader` (Thương lái), thực tế tại các vùng giống như Hữu Lũng cho thấy một chủ thể thường đảm nhiệm nhiều vai trò đan xen.

Hệ thống mô hình hóa bằng danh sách năng lực mềm dẻo (`capabilities`):
- `produce`: Tự ươm hom, gieo hạt, cấy mô cây giống tại cơ sở.
- `sell`: Bán cây giống cho người trồng rừng hoặc đơn vị dự án.
- `buy`: Mua thêm cây giống từ nơi khác.
- `aggregate`: Gom cây giống từ các vườn vệ tinh khi đơn hàng vượt quá lượng cây trong vườn.
- `transport`: Tự điều xe tải, tổ chức bốc xếp và ghép chuyến giao cây đến bãi nhận.

---

## 6. Current Roadmap

```text
P0–P6 / FC0–FC4                 [DONE / CLOSED]
FC5 / FC6                      [SUPERSEDED BY V2]
V2-0                           [APPROVED / INTEGRATING VIA PR #30]
Correctness G01/G02            [DONE / CLOSED — PR #32 MERGED]
Correctness G10                [NEXT — DUY NHẤT]
V2-A1                         [QUEUED / NEXT AFTER G10]
V2-A2 → A3 → A4               [QUEUED / PLANNED]
V2-B1 → B2                     [AFTER V2-A ACCEPTANCE]
REAL PILOT / STOP FEATURE BUILD [AFTER V2-B]
V2-C / V2-D / V2-E              [EVIDENCE GATED / NOT AUTHORIZED]
```

---

Roadmap chi tiết: [V2 Roadmap](../../../docs/product/V2-ROADMAP.md). Status authority: [PROJECT_STATE](../../PROJECT_STATE.md). FC5-1 branch preserved/not adopted; không dependency ngầm hoặc điều kiện hoàn tất V2. V2-A/B giữ schema và authority hiện có; C/D/E không mặc định phải xây.

## 7. Rules & Scope Discipline

### MUST:
1. **MUST** kiểm tra [.agent/PROJECT_STATE.md](../../PROJECT_STATE.md) trước khi nhận định phase hiện tại.
2. **MUST** từ chối mọi yêu cầu thêm tính năng thuộc phase sau nếu task hiện tại chỉ yêu cầu phase trước.
3. **MUST** giữ ngôn ngữ hiển thị tiếng Việt mộc mạc, gần gũi với đời sống lâm nghiệp.

### MUST NOT:
1. **MUST NOT** thêm tính năng chỉ vì *"thường phần mềm quản lý hay có"*, *"sau này đằng nào chả cần"*, hoặc *"thấy hay hay"*.
2. **MUST NOT** đưa bất kỳ dịch vụ đám mây (Cloud sync, Supabase, Auth, Realtime) vào ứng dụng trước khi vượt qua ngưỡng kiểm chứng người dùng thực tế (Validation stage).

---

## 8. Checklist

- [ ] Ý tưởng tính năng có phục vụ trực tiếp cho câu hỏi: *Lô nào còn bán? Giữ cho ai? Giao lúc nào?*
- [ ] Tính năng có thuộc đúng Phase hiện tại ghi trong `PROJECT_STATE.md` không?
- [ ] Có đòi hỏi người dùng phải đăng ký tài khoản / nhập email / mật khẩu không? (Nếu có $\rightarrow$ VI PHẠM).
- [ ] Có phụ thuộc vào kết nối server trực tuyến không? (Nếu có $\rightarrow$ VI PHẠM).

---

## 9. Failure Modes & Examples

- **Failure Mode 1**: Agent thấy màn hình đơn hàng thiếu chức năng "Thanh toán qua chuyển khoản VietQR".
  - *Hành vi sai*: Tự cài thêm thư viện QR code và tạo bảng theo dõi thanh toán.
  - *Hành vi đúng*: Từ chối và ghi chú: Thanh toán/công nợ nằm ngoài scope prototype (Zalo/tiền mặt xử lý việc này).
- **Failure Mode 2**: Agent thấy P0 xong liền tự tiện làm form tạo lô mới ở `/batches/new`.
  - *Hành vi sai*: Tự ý nhảy sang P2 khi P1 chưa xong.
  - *Hành vi đúng*: Giữ placeholder rõ ràng, hoàn thiện luồng Read-only xem lô ở P1 trước.
