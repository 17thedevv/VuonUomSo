# Agent Skill Router — Vườn Ươm

> Bảng tra cứu điều hướng kỹ năng (Skill Router).
> Giúp các AI Agents nhanh chóng xác định **đúng bộ kỹ năng cần kích hoạt** cho từng loại nhiệm vụ.

---

## 0. Quy tắc kích hoạt ban đầu (Bắt buộc)

Trước khi đọc bất kỳ skill nào khác, agent **BẮT BUỘC** đọc:
1. [.agent/PROJECT_STATE.md](./PROJECT_STATE.md): Kiểm tra phase hiện tại và ranh giới scope được phép làm.

---

## 1. Ma trận điều hướng nhiệm vụ (Task-to-Skill Matrix)

| Loại công việc cần làm | Kỹ năng chính cần nạp | Kỹ năng phối hợp bổ sung |
| :--- | :--- | :--- |
| **Câu hỏi về sản phẩm, đối tượng dùng, roadmap, scope** | `product-context` | — |
| **Giao diện, Component, Copy chữ, Form, Mobile Responsive** | `ux-design` | `product-context` |
| **Lô cây, Tồn kho, Giữ cây, Đơn hàng, Chuyến giao, Số lượng** | `domain-rules` | `product-context` |
| **Kiến trúc, Repository, IndexedDB, Database Schema, Dexie** | `architecture` | `domain-rules` |
| **Lập trình tính năng mới (Coding task)** | `implementation` + `testing` | `domain-rules`, `ux-design` |
| **Viết Unit test, Integration test, Kiểm tra Invariants** | `testing` | `domain-rules` |
| **Thao tác Git, commit, tạo branch, PR, CI / GitHub Actions** | `github-workflow` | `implementation`, `testing` |
| **Đo lường, Thử nghiệm thực địa, Thu thập phản hồi Pilot** | `validation` | `product-context` |
| **Review code, Kiểm tra PR, Audit chất lượng, Kiểm tra phase**| `review-audit` | Tất cả skills liên quan đến PR |

> **Quy tắc phối hợp bắt buộc**:
> - Mọi **Code task** $\rightarrow$ kích hoạt `implementation` + `testing`.
> - Task có liên quan **commit / branch / PR / CI / GitHub** $\rightarrow$ kích hoạt thêm `github-workflow`.

---

## 2. Hướng dẫn nạp kỹ năng chi tiết

### Trường hợp 1: Thiết kế hoặc sửa UI/UX (Màn hình, Nút bấm, Bảng chọn)
- Đọc: `skills/ux-design/SKILL.md`
- Trọng tâm: Quy tắc ngôn ngữ tiếng Việt lâm nghiệp, màn hình dọc 360–430px, tap target $\ge 44\text{px}$, chuẩn hóa hiển thị "vạn".

### Trường hợp 2: Đụng vào số lượng, lô giống, giữ cây, đơn hoặc giao hàng
- Đọc: `skills/domain-rules/SKILL.md`
- Trọng tâm: Bất biến số lượng (Invariants), công thức phân biệt `physical stock` vs `ready stock` vs `available stock`.

### Trường hợp 3: Thay đổi tầng dữ liệu, IndexedDB, Schema, Service, Hooks
- Đọc: `skills/architecture/SKILL.md`
- Trọng tâm: Boundary repository rõ ràng, UI không gọi DB trực tiếp, không over-engineer với Redux/CQRS/DI.

### Trường hợp 4: Nhận lệnh viết code tính năng mới
- Đọc: `skills/implementation/SKILL.md` kết hợp `skills/testing/SKILL.md`
- Trọng tâm: Chu trình phát triển (feature branch $\rightarrow$ implementation $\rightarrow$ typecheck $\rightarrow$ lint $\rightarrow$ tests $\rightarrow$ build $\rightarrow$ commit $\rightarrow$ review/audit $\rightarrow$ merge main).

### Trường hợp 5: Viết bài test hoặc sửa lỗi hồi quy
- Đọc: `skills/testing/SKILL.md`
- Trọng tâm: Ưu tiên bảo vệ Domain Invariants > UI detail; mọi bug số lượng phải có regression test.

### Trường hợp 6: Thao tác Git, commit, branch, CI pipeline hoặc chuẩn bị merge
- Đọc: `skills/github-workflow/SKILL.md`
- Trọng tâm: 5 nhóm rule (Branching, Commit atomic, Pull/merge safety, CI tối thiểu, Agent permissions).

### Trường hợp 7: Đánh giá kết quả thử nghiệm thực tế hoặc quyết định dừng/tiếp tục
- Đọc: `skills/validation/SKILL.md`
- Trọng tâm: Thang đo bằng chứng, quy tắc Stop-build sau P6 để đem sản phẩm ra vườn xác thực.

### Trường hợp 8: Được yêu cầu review code hoặc kiểm tra hoàn thành phase
- Đọc: `skills/review-audit/SKILL.md`
- Trọng tâm: Thứ tự review (Correctness $\rightarrow$ Scope compliance $\rightarrow$ Architecture $\rightarrow$ UX $\rightarrow$ Tests), phân loại lỗi (BLOCKER, HIGH, MEDIUM, LOW).
