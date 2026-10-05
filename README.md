# Vườn Ươm — Sổ cây giống trên điện thoại

> **Lưu ý quan trọng**: Đây là **validation prototype** (bản mẫu thử nghiệm hành vi người dùng), **chưa phải production SaaS**.
> Hệ thống được thiết kế tối ưu cho **learning speed > scalability**, lưu trữ 100% cục bộ trên thiết bị qua IndexedDB (Dexie), không sử dụng backend hay cloud database trong giai đoạn này.

---

## 1. Requirements

- **Node.js**: >= 18 (khuyến nghị v20+)
- **NPM**: >= 9
- **Trình duyệt**: Bất kỳ trình duyệt hiện đại nào trên điện thoại hoặc máy tính hỗ trợ IndexedDB & Service Worker (Chrome, Safari, Edge, Cốc Cốc, Zalo Webview).

---

## 2. Install & Cài đặt

```bash
npm install
```

---

## 3. Chạy môi trường phát triển (Dev)

```bash
npm run dev
```

Truy cập ứng dụng tại: `http://localhost:5173` (giao diện tối ưu cho kích thước màn hình điện thoại 360px–430px).

---

## 4. Chạy kiểm thử (Test)

```bash
# Chạy toàn bộ test suites (Vitest)
npm test

# Chạy test ở chế độ watch
npm run test:watch
```

Bộ test bao gồm:
- **Unit test**: Bộ phân tích số lượng lâm nghiệp (`parseQuantity`: 3 vạn, 3v, 4,52 vạn, 30.000, 30,000...) và hàm tính toán khả dụng (`availableQuantity`, `reservedQuantity`, `survivalRate`).
- **Repository test**: Kiểm tra tính bền vững dữ liệu IndexedDB (ghi cơ sở -> đọc lại; khôi phục dữ liệu mẫu).
- **Component test**: Kiểm tra luồng màn hình Mở sổ (`/onboarding`) và Tổng quan hôm nay (`/today`).

---

## 5. Kiểm tra chất lượng mã nguồn & Build

```bash
# Typecheck TypeScript (chế độ strict)
npm run typecheck

# Linter (oxlint)
npm run lint

# Production build (kèm sinh PWA service worker và manifest)
npm run build

# Preview bản build
npm run preview
```

---

## 6. Cấu trúc dự án (Project Structure)

```text
src/
├── app/
│   ├── App.tsx          # Root application component
│   ├── router.tsx       # Cấu hình React Router & điều hướng bảo vệ
│   └── bootstrap.ts     # Khởi tạo trạng thái ban đầu từ local storage
│
├── domain/
│   ├── organization.ts  # Kiểu dữ liệu Cơ sở / Vườn ươm & vai trò
│   ├── batch.ts         # Kiểu dữ liệu Lô cây & trạng thái sinh trưởng
│   ├── order.ts         # Kiểu dữ liệu Đơn hàng
│   ├── reservation.ts   # Kiểu dữ liệu Giữ cây cho khách
│   ├── shipment.ts      # Kiểu dữ liệu Chuyến giao
│   ├── contact.ts       # Kiểu dữ liệu Khách hàng / Vườn liên kết
│   └── quantity.ts      # Parser số lượng & Pure functions tính tồn/khả dụng
│
├── data/
│   ├── db.ts            # Dexie schema v1
│   ├── repositories/    # Explicit repository interfaces & Dexie implementations
│   ├── seed.ts          # Bộ dữ liệu mẫu Vườn Hồng Anh (Hữu Lũng) & reset
│   └── backup.ts        # Xuất dữ liệu cục bộ ra JSON
│
├── features/
│   ├── onboarding/      # Màn hình mở sổ lần đầu (/onboarding)
│   ├── today/           # Màn hình làm việc hôm nay (/today)
│   ├── batches/         # Màn hình quản lý lô cây (/batches, /batches/new, /batches/:id)
│   ├── orders/          # Màn hình đơn hàng (/orders, /orders/new, /orders/:id, /orders/:id/reserve)
│   ├── shipments/       # Màn hình chuyến giao (/shipments, /shipments/:id)
│   ├── dossiers/        # Màn hình hồ sơ nguồn gốc cây giống (/dossiers/:batchId)
│   └── more/            # Màn hình cài đặt, chế độ & quản lý dữ liệu (/more)
│
├── shared/
│   ├── components/      # AppShell, BottomNav, PageHeader, PrimaryButton, StatusBadge, EmptyState, OfflineBadge
│   └── hooks/           # useOnlineStatus hook
│
└── analytics/
    └── events.ts        # Event log cục bộ cho domain events
```

---

## 7. Demo mode & Pilot mode

Ứng dụng hỗ trợ 2 chế độ hoạt động:

1. **Demo mode (Chế độ Dùng thử)**:
   - Cơ sở: **Vườn Hồng Anh** (với đầy đủ các vai trò: Ươm cây, Bán cây, Gom cây, Giao cây).
   - Lô giống mẫu:
     - `BV16 #12`: Bạch đàn BV16 (ban đầu 50.000, hiện có 45.200, đủ bán 32.000, đã giữ 10.000 -> còn bán **22.000** cây).
     - `AH1 #07`: Keo lai AH1 (30.100 cây đang sắp đủ bán).
     - `BV523 #03`: Bạch đàn BV523 (18.400 cây đủ bán, có hạn xuất bán sắp quá lứa).
   - Khách hàng & Vườn liên kết: Anh Hùng, Chị Lan, Vườn Thảo, Vườn Hồng, Vườn An.
   - Thao tác: Bấm **"Cài lại dữ liệu mẫu (Reset demo data)"** tại màn hình **Thêm** (`/more`) hoặc chọn ngay tại màn hình Mở sổ.

2. **Pilot mode (Chế độ Thực tế)**:
   - Dành cho chủ vườn hoặc thương lái thật sử dụng.
   - Bắt đầu với sổ trắng hoàn toàn, người dùng nhập tên vườn và chọn các hoạt động thực tế.

---

## 8. Hành vi lưu trữ dữ liệu cục bộ (Local Data Behavior)

- Toàn bộ dữ liệu được lưu trong **IndexedDB** của trình duyệt máy người dùng thông qua thư viện Dexie (Database: `VuonUomDB`).
- Không có backend, không gửi dữ liệu ra ngoài, hoàn toàn riêng tư trên máy.
- Có tính năng xuất sao lưu JSON tại màn hình `/more`.
- Khi thiết bị không có internet, ứng dụng hiển thị thông báo:
  > *"Đang dùng ngoại tuyến. Dữ liệu đang được lưu trên thiết bị này."*
  (Không gây hiểu nhầm về việc đồng bộ đám mây).

---

## 9. Giai đoạn hiện tại: Phase P0 Foundation

Mục tiêu giai đoạn P0 là xây dựng nền móng kiến trúc vững chắc, bao gồm:
- Khởi tạo mobile app shell hoạt động tốt trên màn hình điện thoại 360px–430px;
- Điều hướng hoàn chỉnh với 4 tab chính;
- IndexedDB + Schema versioning + Repository boundary rõ ràng;
- Parser số lượng thích ứng ngôn ngữ bản địa ("3 vạn", "4,52 vạn", "30.000");
- Seed data & cơ chế chuyển đổi Demo/Pilot;
- PWA manifest & Service worker chạy ngoại tuyến;
- Đầy đủ test suite (Unit, Integration, Component).
