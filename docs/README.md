# Vườn Ươm — Project Documentation

Thư mục `docs/` chứa tài liệu đặc tả, kiến trúc, nghiên cứu sản phẩm và hướng dẫn phát triển của dự án **Vườn Ươm**.

---

## Cấu trúc tài liệu

```text
docs/
├── architecture/      # Tài liệu thiết kế hệ thống, data boundary, Dexie schema, offline-first
├── product/           # Bối cảnh thị trường cây giống, user persona, roadmap, domain model
├── ux/                # Thiết kế trải nghiệm Zalo-first, mobile ergonomics, typography, tokens
└── development/       # Hướng dẫn setup môi trường, quy chuẩn kiểm thử, troubleshooting
```

---

## 1. `architecture/`
- Kiến trúc tầng: `UI -> Domain -> Repository -> Dexie IndexedDB`.
- Chiến lược mở rộng trong tương lai:
  - Khi có Cloud backend: Thêm `supabase/` ở root.
  - Khi có Native mobile app: Thêm Capacitor shell trong `web/` (`web/android`, `web/ios`).

## 2. `product/`
- Định vị: **Sổ cây giống trên điện thoại** cho hệ sinh thái lâm nghiệp (Hữu Lũng, Lạng Sơn và mở rộng).
- Bất biến cốt lõi: Quản lý lô, khả năng đáp ứng (Availability), giữ cây (Reservation), xuất xe (Shipment).

## 3. `ux/`
- Nguyên lý Zalo: Giao diện một tay, font chữ rõ ràng, nút bấm lớn $\ge 44\text{px}$.
- Ô nhập số chuẩn lâm nghiệp: Hỗ trợ tự nhiên cả "vạn" và "cây".

## 4. `development/`
- Hướng dẫn chạy và build web app: Xem [root README.md](../README.md).
