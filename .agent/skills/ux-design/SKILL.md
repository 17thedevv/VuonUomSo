---
name: ux-design
description: >-
  Use this skill for all UI, visual design, copy, form interactions, mobile constraints,
  navigation, and forestry terminology rules in Vườn Ươm.
---

# UX & UI Design Guidelines

## 1. Purpose

Thiết lập các tiêu chuẩn thiết kế trải nghiệm người dùng, ngôn ngữ hiển thị bản địa, kích thước cảm ứng trên điện thoại thông minh và triết lý giao diện tối giản cho Vườn Ươm.

---

## 2. Core Law

> **Một người biết dùng Zalo phải có thể dùng Vườn Ươm mà không cần học phần mềm quản lý.**

---

## 3. When to Use & When NOT to Use

- **WHEN TO USE**:
  - Khi tạo hoặc sửa bất kỳ màn hình, component, form hoặc modal nào.
  - Khi viết copy văn bản, thông báo lỗi, gợi ý nhập liệu (placeholders).
  - Khi thiết kế ô nhập số lượng, nút bấm, menu điều hướng.
  - Khi đánh giá khả năng sử dụng trên thiết bị di động một tay.
- **WHEN NOT TO USE**:
  - Khi kiểm tra tính đúng đắn toán học của số lượng tồn kho (dùng `domain-rules`).
  - Khi kết nối repository hoặc viết migration database (dùng `architecture`).

---

## 4. Forestry Language Mapping (Bắt buộc)

Không bao giờ để lộ các thuật ngữ kỹ thuật / tiếng Anh trong giao diện người dùng:

| Khái niệm nghiệp vụ (Internal) | Thuật ngữ hiển thị UI (Tiếng Việt chuẩn) | Ý nghĩa với người làm giống |
| :--- | :--- | :--- |
| `Batch` | **Lô cây** | Một đợt ươm cây cùng giống, cùng ngày vào bầu |
| `Availability` | **Cây còn bán** | Số cây đủ tiêu chuẩn xuất vườn chưa bị khách giữ |
| `Reservation` | **Đã giữ cho khách** | Cây đã chốt miệng hoặc nhận cọc, chờ ngày bốc |
| `Shipment` | **Chuyến giao / Đã giao** | Xe bốc cây thực tế chở đi bãi nhận |
| `Mortality` | **Hao hụt** | Cây chết trong quá trình ươm hoặc dập nát khi chở |
| `Traceability` | **Hồ sơ nguồn gốc** | Giấy chứng nhận nguồn giống, hóa đơn hạt/hom |
| `Propagating` | **Đang ươm** | Cây mới cắm hom / gieo hạt, chưa đủ tuổi xuất |
| `Nearly Ready` | **Sắp đủ bán** | Cây đang lớn, dự kiến 1–2 tuần nữa xuất được |
| `Ready` | **Đủ bán** | Đạt chiều cao, đường kính cổ rễ, rễ bọc kín bầu |
| `Depleted` | **Đã xuất hết** | Lô cây đã bán sạch |

---

## 5. Mobile Ergonomics & Visual Constraints

### Kích thước & Trọng tâm:
- **Khung màn hình mục tiêu**: Chiều rộng $360\text{px} - 430\text{px}$ (Android phổ biến tại nông thôn).
- **Cỡ chữ nội dung (Body text)**: $\ge 16\text{px}$ để người lớn tuổi đọc rõ ngoài trời nắng.
- **Con số quan trọng (Số lượng cây)**: $22\text{px} - 28\text{px}$, in đậm (`font-bold` hoặc `font-black`).
- **Vùng chạm (Tap Target)**: Tối thiểu $44\times 44\text{px}$ cho mọi nút, checkbox, thẻ chọn.
- **Nút hành động chính (Primary CTA)**: Chiều cao $\ge 48\text{px}$, độ rộng toàn màn hình (`w-full`), màu xanh lá cây đậm thực dụng (`bg-emerald-700`).
- **Thao tác một tay**: Đặt các nút quan trọng ở nửa dưới màn hình trong tầm với của ngón cái.

### Điều cấm kỵ về tương tác (Interaction Prohibitions):
- **CẤM** tương tác chỉ dựa vào vuốt (`swipe-only`). Người dùng ngón tay thô ráp hoặc màn hình dính nước rất khó vuốt chính xác.
- **CẤM** ẩn chức năng chỉ sau thao tác bấm giữ (`long-press-only`).
- **CẤM** dùng icon trần không có chữ (`icon-only`) cho các nút bấm điều hướng hoặc hành động quan trọng.
- **CẤM** thể hiện trạng thái chỉ bằng màu sắc. Mọi badge trạng thái PHẢI có cả biểu tượng (icon) và chữ rõ nghĩa.

---

## 6. Navigation Rules

- Thanh điều hướng đáy (`BottomNav`) **tối đa 4 mục duy nhất**:
  1. **Hôm nay** (`/today`)
  2. **Lô cây** (`/batches`)
  3. **Đơn hàng** (`/orders`)
  4. **Thêm** (`/more`)
- **KHÔNG ĐƯỢC** tùy tiện thêm tab thứ 5 vào thanh điều hướng đáy.

---

## 7. Quantity Input UX

Chủ vườn và thương lái thường nói: *"Khách Tuấn Sơn đặt 3 vạn rưỡi BV16"*.

### Quy tắc hiển thị & nhập liệu:
1. Ô nhập số lượng **BẮT BUỘC** chấp nhận đa dạng định dạng:
   - `30000`
   - `30.000` (dấu chấm hàng nghìn chuẩn Việt Nam)
   - `30,000` (dấu phẩy hàng nghìn)
   - `3 vạn` hoặc `3v`
   - `4,52 vạn` hoặc `4.52 vạn`
2. **Normalize & Live Preview**:
   - Khi người dùng gõ `4,52 vạn`, ngay lập tức hiển thị dòng xác nhận màu xanh bên dưới:
     $$\mathbf{=\; 45.200\text{ cây}}$$
   - Tránh việc người dùng nhầm lẫn giữa 4.520 cây và 45.200 cây.

---

## 8. Visual Direction & Style Discipline

- **Thẩm mỹ**: Sạch sẽ, thực dụng, tương phản cao, phông chữ hệ thống rõ ràng.
- **TUYỆT ĐỐI TRÁNH**:
  - Hiệu ứng chuyển màu sặc sỡ (Gradients).
  - Kính mờ (Glassmorphism / Backdrop blur nặng nề).
  - Dashboard ERP nhồi nhét hàng chục thẻ biểu đồ phân tích nhỏ li ti.
  - Hiệu ứng hoạt họa (Animation) lướt qua lướt lại gây chậm trễ thao tác.

---

## 9. Error Philosophy (Thông báo lỗi nhân bản)

Thông báo lỗi phải nói bằng ngôn ngữ bà con nhà nông, chỉ ra nguyên nhân và gợi ý cách giải quyết.

- ❌ **SAI (Kỹ thuật/Khó hiểu)**:
  `Error: Insufficient batch availability for reservation ID req-902.`
- ✅ **ĐÚNG (Thực tế/Tận tâm)**:
  `Không đủ BV16 để giữ 30.000 cây. Vườn mình hiện còn 22.000 cây đủ bán.`

---

## 10. Checklist cho Agent khi tạo UI

- [ ] Kích thước tap target có đạt tối thiểu $44\times 44\text{px}$ không?
- [ ] Cỡ chữ nội dung có từ $16\text{px}$ trở lên không?
- [ ] Thuật ngữ hiển thị có dùng từ thuần Việt nông nghiệp (Lô cây, Cây còn bán, Đã giữ...) không?
- [ ] Nút CTA có dễ bấm bằng ngón tay cái trên màn hình điện thoại không?
- [ ] Số lượng có được định dạng dễ đọc với dấu chấm phân tách hàng nghìn ($45.200$) không?
- [ ] Thông báo lỗi có giải thích rõ nguyên nhân thay vì quăng mã lỗi kỹ thuật không?
