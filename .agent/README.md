# Vườn Ươm — Agent Skill System

Thư mục `.agent/` chứa toàn bộ hệ thống kỹ năng chuẩn hóa (Agent Skills), quy tắc nghiệp vụ (Domain Rules), hướng dẫn kiến trúc và ranh giới sản phẩm dành cho các AI Coding/Review/Design Agents làm việc trong dự án **Vườn Ươm**.

---

## 1. Hệ thống Skill là gì?

Skill system là một tập hợp các tài liệu vận hành được cấu trúc theo chuẩn của Google Antigravity. Hệ thống biến kiến thức cốt lõi của dự án thành các tài liệu kỹ thuật có thể hành động được, giúp mọi agent:
- Không bị trôi lệch yêu cầu (prompt drift);
- Không tự ý phát minh tính năng ngoài phase;
- Không vi phạm các bất biến tồn kho cây giống lâm nghiệp;
- Giữ vững nguyên lý thiết kế: *Đơn giản, thực dụng như Zalo*.

---

## 2. Cách Agents nạp và sử dụng Skills

1. **Bước 1 — Xác định Phase hiện tại**:
   Đọc [.agent/PROJECT_STATE.md](./PROJECT_STATE.md) để biết giai đoạn phát triển hiện hành và các giới hạn được phép làm.
2. **Bước 2 — Tra cứu Skill cần dùng**:
   Đọc [.agent/router.md](./router.md) để map loại task với skill phù hợp.
3. **Bước 3 — Đọc nội dung Skill tương ứng**:
   Đọc file `SKILL.md` của skill cần dùng (ví dụ: `.agent/skills/domain-rules/SKILL.md`).
4. **Bước 4 — Tuân thủ Checklist & Báo cáo kết quả**:
   Thực hiện các bước theo quy trình của `implementation` hoặc `review-audit`.

---

## 3. Cấu trúc thư mục

```text
.agent/
├── README.md               # Tài liệu tổng quan hệ thống skill (file này)
├── PROJECT_STATE.md        # Single Source of Truth cho Phase hiện tại & Roadmap
├── router.md               # Bảng tra cứu điều hướng: Task -> Skill
└── skills/
    ├── product-context/    # Bản chất sản phẩm, người dùng mục tiêu, ranh giới scope
    ├── ux-design/          # Thiết kế mobile 360-430px, thuật ngữ lâm nghiệp, UX vạn
    ├── domain-rules/       # Bất biến tồn kho, công thức physical vs ready vs available
    ├── architecture/       # Ranh giới phân tầng UI -> Domain -> Repository -> Dexie
    ├── implementation/     # Quy trình 5 bước code tính năng, kỷ luật nghiệm thu
    ├── testing/            # Thứ tự ưu tiên test, policy bắt buộc cho regression
    ├── github-workflow/    # Quy tắc Git/GitHub, branching, atomic commits, merge safety, CI
    ├── validation/         # Thang đo bằng chứng thực tế, quy tắc STOP-BUILD sau P6
    └── review-audit/       # Quy trình 5 bước review/audit code, mô hình lỗi BLOCKER/HIGH
```

---

## 4. Cập nhật Phase hiện tại ở đâu?

Khi dự án hoàn thành một milestone và sẵn sàng chuyển phase:
- **CHỈ CẬP NHẬT TẠI MỘT NƠI DUY NHẤT**: [.agent/PROJECT_STATE.md](./PROJECT_STATE.md).
- Không hardcode trạng thái phase rải rác trong các file skill để tránh mâu thuẫn dữ liệu.

---

## 5. Khi nào thêm Skill mới?

Chỉ thêm skill mới khi:
- Xuất hiện một quy trình nghiệp vụ hoàn toàn mới chưa được bao quát bởi 8 skills hiện tại (ví dụ: sau này có thể thêm skill `export-dossier` ở P5 hoặc `pilot-telemetry` ở P6).
- **KHÔNG THÊM SKILL** chỉ để ghi chép tài liệu lý thuyết chung chung mà agent không thể dùng để hành động.
