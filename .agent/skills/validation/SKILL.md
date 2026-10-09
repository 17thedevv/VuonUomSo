---
name: validation
description: >-
  Use this skill to guide user validation strategy, empirical evidence thresholds,
  and enforce the current pilot gate to prevent unverified feature development.
---

# Product Validation Strategy & The Stop-Build Rule

## 1. Purpose

Ngăn chặn căn bệnh phổ biến của các AI Coding Agent: **tự ý thêm tính năng cho "trông hoàn thiện"** dựa trên cảm giác chủ quan thay vì dữ liệu bằng chứng thực tế từ người dùng vườn ươm. Kỹ năng này định nghĩa thang đo bằng chứng xác thực và quy tắc **STOP FEATURE BUILD** tại pilot gate hiện hành trong PROJECT_STATE.

---

## 2. When to Use & When NOT to Use

- **WHEN TO USE**:
  - Khi thảo luận về tính hiệu quả hoặc giá trị thực tế của một tính năng.
  - Khi quyết định có nên đầu tư làm tiếp một tính năng mới hay không.
  - Khi xây dựng công cụ đo lường thực địa trong Phase P6.
  - Khi đến pilot gate hiện hành và cần dừng feature build để mang đi thử nghiệm.
- **WHEN NOT TO USE**:
  - Khi giải quyết lỗi cú pháp code, lỗi type, hay viết test kỹ thuật (dùng `implementation` hoặc `testing`).
  - Khi thiết kế giao diện form nhập liệu (dùng `ux-design`).

---

## 3. Hierarchy of Evidence Strength (Thang đo độ mạnh của bằng chứng)

Lời khen suông từ bạn bè hoặc người quen **KHÔNG ĐƯỢC COI LÀ VALIDATION**. Mức độ tin cậy của bằng chứng được xếp hạng như sau:

$$\begin{aligned}
\text{Cấp 1 (Yếu nhất):} &\quad \text{Nói "Ứng dụng hay đấy, tiện đấy"} \\
\text{Cấp 2:} &\quad \text{Mở app nhập vài số liệu giả cho vui} \\
\text{Cấp 3:} &\quad \text{Chủ vườn tự mở sổ, gõ đúng tên lô và số cây thật trong vườn} \\
\text{Cấp 4:} &\quad \text{Quay lại dùng vào ngày hôm sau khi có đơn hàng mới} \\
\text{Cấp 5:} &\quad \text{Tự chủ động giới thiệu cho chủ vườn hoặc thương lái khác dùng} \\
\mathbf{Cấp\; 6\; (Mạnh\; nhất):} &\quad \mathbf{Sẵn\; sàng\; trả\; tiền\; (WTP)\; để\; tiếp\; tục\; dùng\; sổ}
\end{aligned}$$

---

## 4. Năm câu hỏi cốt tử Prototype cần xác thực

Prototype Vườn Ươm được sinh ra để trả lời 5 câu hỏi thực nghiệm:
1. **Pain (Nỗi đau thực tế)**:
   Việc nhầm lẫn số lượng cây còn bán và quên đơn giữ cây có thực sự gây mất tiền và mất uy tín nghiêm trọng cho chủ vườn/thương lái không?
2. **Adoption (Khả năng tiếp nhận)**:
   Một người chỉ quen dùng Zalo có chịu mở app ra gõ số lượng thay vì lấy bút ghi vào mép vỏ bao xi măng không?
3. **Retention (Tỷ lệ quay lại)**:
   Sau ngày đầu tiên, họ có tiếp tục dùng app để cập nhật khi bốc cây lên xe không?
4. **Willingness-to-pay (Khả năng chi trả)**:
   Họ có sẵn sàng trả phí (dù chỉ $50.000\text{đ} - 100.000\text{đ}/\text{tháng}$) để giữ dữ liệu an toàn và tiện lợi không?
5. **Segment (Phân khúc phù hợp nhất)**:
   Nhóm nào cần nhất? Chủ vườn ươm nhỏ, vườn ươm lớn, đầu mối gom cây hay lái xe vận chuyển?

---

## 5. Current GO Threshold (Ngưỡng tối thiểu để cân nhắc chuyển sang Production)

Dự án **TUYỆT ĐỐI CHƯA ĐƯỢC PHÉP** đầu tư xây dựng Cloud Backend, Microservices hay Native Mobile App trừ khi đạt được ngưỡng tối thiểu sau ngoài thực địa:

- $\mathbf{3 - 5}$ **Người dùng kích hoạt thực tế (Activated Users)**: Tự nhập dữ liệu cây thật của vườn mình.
- $\mathbf{\ge 2}$ **Người dùng duy trì (Return Users)**: Sử dụng liên tục trong ít nhất 2 tuần khi có giao dịch cây giống.
- $\mathbf{\ge 1}$ **Khách hàng trả tiền thật (Real WTP / Paid Pilot)**: Sẵn sàng trả phí để sử dụng giải pháp.

---

## 6. The "STOP-BUILD" Rule — current pilot gate

Chỉ thị trực tiếp người dùng ngày 09/10/2026 đã supersede FC5/FC6 và thay gate STOP sau P6 bằng **correctness cleanup → V2-A → V2-B → REAL PILOT**. Xem [PROJECT_STATE](../../PROJECT_STATE.md), [V2 Roadmap](../../../docs/product/V2-ROADMAP.md). Đây là ngoại lệ scope được user chỉ định, không cho agent tự mở thêm phase.

### Mệnh lệnh cho Agent:
- Current task authority: **G01/G02/G10 DONE / CLOSED (#32/#33 merged); V2-A1 DONE / CLOSED (#35 merged); V2-A2 NEXT duy nhất**. A3/A4 queued; A2 chỉ thực hiện trong task riêng theo frozen contract. Task integration dừng ở closure, không triển khai A2.
- Chỉ thực hiện từng slice cleanup/A/B theo roadmap; không tự triển khai C/D/E hoặc quay lại hoàn tất FC5/FC6.
- Sau V2-B: **STOP FEATURE BUILD → USER VALIDATION**, dùng thiết bị/số liệu vườn thật. Correctness fixes vẫn được phép khi phát hiện lỗi.
- Pilot có năm task và metrics time/taps/chọn sai lô/nhầm ready-available/Excel/thông tin ghi ngoài app trong roadmap. Không kết luận PASS từ browser/teardown/lời khen.
- IME điện thoại thật, installed-PWA offline và dùng lại ngày sau phải ghi bằng chứng riêng.
- Chỉ mở C/D/E khi có evidence và task/contract/scope riêng. Ngưỡng production §5 không thay đổi; evidence không tự cấp authorization backend.

---

## 7. Validation Checklist cho Agent

- [ ] Tính năng đang làm có phục vụ trực tiếp cho một thí nghiệm xác thực không?
- [ ] Có đang bị cám dỗ "làm thêm cho hoàn chỉnh" mà không có bằng chứng từ người dùng không?
- [ ] Có đang coi lời khen chủ quan là dấu hiệu thành công của sản phẩm không?
- [ ] Nếu đã hoàn tất V2-B, đã dừng feature build và bắt đầu real pilot chưa?
