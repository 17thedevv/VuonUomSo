---
name: validation
description: >-
  Use this skill to guide user validation strategy, empirical evidence thresholds,
  and enforce the stop-build rule after P6 to prevent unverified feature development.
---

# Product Validation Strategy & The Stop-Build Rule

## 1. Purpose

Ngăn chặn căn bệnh phổ biến của các AI Coding Agent: **tự ý thêm tính năng cho "trông hoàn thiện"** dựa trên cảm giác chủ quan thay vì dữ liệu bằng chứng thực tế từ người dùng vườn ươm. Kỹ năng này định nghĩa thang đo bằng chứng xác thực và quy tắc **STOP CODE** khi kết thúc phase P6.

---

## 2. When to Use & When NOT to Use

- **WHEN TO USE**:
  - Khi thảo luận về tính hiệu quả hoặc giá trị thực tế của một tính năng.
  - Khi quyết định có nên đầu tư làm tiếp một tính năng mới hay không.
  - Khi xây dựng công cụ đo lường thực địa trong Phase P6.
  - Khi dự án hoàn thành P6 và cần kích hoạt quy tắc dừng code để mang đi thử nghiệm.
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

## 6. The "STOP-BUILD" Rule (Quy tắc dừng code sau P6)

Khi Phase P6 (Validation Instrumentation) hoàn tất:

$$\mathbf{STOP\; CODE} \quad\Longrightarrow\quad \mathbf{USER\; VALIDATION}$$

### Mệnh lệnh cho Agent:
- Sau khi P6 hoàn thành, **ĐÓNG BĂNG MỌI HOẠT ĐỘNG PHÁT TRIỂN TÍNH NĂNG MỚI**.
- Không được phép tự vẽ ra P7, P8 hay "tối ưu hóa thêm chút nữa".
- Mang bản PWA ra các vườn ươm tại Hữu Lũng, Tuấn Sơn để người thật dùng thử và ghi nhận phản hồi.

---

## 7. Validation Checklist cho Agent

- [ ] Tính năng đang làm có phục vụ trực tiếp cho một thí nghiệm xác thực không?
- [ ] Có đang bị cám dỗ "làm thêm cho hoàn chỉnh" mà không có bằng chứng từ người dùng không?
- [ ] Có đang coi lời khen chủ quan là dấu hiệu thành công của sản phẩm không?
- [ ] Nếu đã đến cuối P6, đã dừng code và kích hoạt Stop-build rule chưa?
