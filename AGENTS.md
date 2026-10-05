# Vườn Ươm — AI Agent Operating Instructions

Chào mừng bạn tham gia lập trình và phát triển dự án **Vườn Ươm** (*Sổ cây giống trên điện thoại*).

Để đảm bảo tính nhất quán tuyệt đối về kiến trúc, trải nghiệm người dùng, bất biến số lượng và ranh giới roadmap, bạn **BẮT BUỘC** tuân thủ hệ thống kỹ năng chuẩn hóa của dự án.

---

## 1. Điểm khởi đầu bắt buộc

Trước khi thực hiện bất kỳ thay đổi nào:
1. Đọc [.agent/PROJECT_STATE.md](file:///.agent/PROJECT_STATE.md) để biết **Phase hiện tại** và những gì được phép / bị cấm làm.
2. Đọc [.agent/router.md](file:///.agent/router.md) để biết **bộ kỹ năng (Skills)** cần kích hoạt cho công việc của bạn.

---

## 2. Hệ thống kỹ năng dự án (Project Skills)

Hệ thống skills nằm trong thư mục [.agent/skills/](file:///.agent/skills/):

- [`product-context`](file:///.agent/skills/product-context/SKILL.md): Bản chất sản phẩm, bối cảnh người làm giống lâm nghiệp, ranh giới scope.
- [`ux-design`](file:///.agent/skills/ux-design/SKILL.md): Nguyên tắc Zalo-first, di động một tay 360–430px, thuật ngữ tiếng Việt lâm nghiệp, ô nhập số "vạn".
- [`domain-rules`](file:///.agent/skills/domain-rules/SKILL.md): Bất biến số lượng, công thức phân biệt Tồn kho vật lý $\neq$ Cây đủ chuẩn $\neq$ Cây còn bán.
- [`architecture`](file:///.agent/skills/architecture/SKILL.md): Ranh giới UI $\rightarrow$ Domain $\rightarrow$ Repository $\rightarrow$ Dexie IndexedDB; cấm over-engineering.
- [`implementation`](file:///.agent/skills/implementation/SKILL.md): Quy trình 5 bước code tính năng, kỷ luật nghiệm thu.
- [`testing`](file:///.agent/skills/testing/SKILL.md): Ưu tiên Invariants > UI; chính sách bắt buộc regression test khi sửa lỗi tồn kho.
- [`validation`](file:///.agent/skills/validation/SKILL.md): Thang đo bằng chứng thực tế, quy tắc STOP-BUILD sau P6 để mang app ra vườn kiểm chứng.
- [`review-audit`](file:///.agent/skills/review-audit/SKILL.md): Quy trình 5 bước audit code, mô hình lỗi BLOCKER/HIGH/MEDIUM/LOW.

---

## 3. Ba nguyên tắc vàng bất di bất dịch

1. **Nguyên lý Zalo**: *Một người biết dùng Zalo phải có thể dùng Vườn Ươm mà không cần học phần mềm quản lý.*
2. **Kỷ luật Phase**: *Không tự ý làm tính năng thuộc phase sau khi phase hiện tại chưa hoàn thành.*
3. **Bất biến số lượng**: *Không bao giờ bán khống cây; giữ cây (reservation) không làm giảm tồn kho vật lý; xuất xe (shipment) mới làm giảm tồn kho vật lý.*
