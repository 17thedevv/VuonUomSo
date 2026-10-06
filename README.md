# Vườn Ươm — Sổ cây giống trên điện thoại

> **Lưu ý quan trọng**: Đây là **validation prototype** (bản mẫu thử nghiệm hành vi người dùng), **chưa phải production SaaS**.
> Hệ thống được thiết kế tối ưu cho **learning speed > scalability**, lưu trữ 100% cục bộ trên thiết bị qua IndexedDB (Dexie), không sử dụng backend hay cloud database trong giai đoạn này.

---

## 1. Cấu trúc tổng thể Repository

```text
VuonUomSo/
├── web/          # Sản phẩm ứng dụng Web/PWA chạy được
├── docs/         # Tài liệu đặc tả, kiến trúc, bối cảnh lâm nghiệp & UX
├── .agent/       # Hệ điều hành Agent (Skills, Project State, Router)
├── .github/      # Tự động hóa repository & CI workflow
├── .gitignore
├── AGENTS.md     # Chỉ dẫn vận hành cốt lõi cho AI Agents
└── README.md
```

- **`web/`**: Chứa toàn bộ mã nguồn frontend, dependencies, test suite và cấu hình build Vite/PWA.
- **`docs/`**: Chứa tài liệu thiết kế hệ thống, bối cảnh người làm giống và hướng dẫn phát triển.
- **`.agent/`**: Chứa kiến thức dự án và các kỹ năng chuẩn hóa của agent (Single Source of Truth).
- **`.github/`**: Chứa CI workflow kiểm tra tự động (`typecheck -> lint -> test -> build`).

---

## 2. Requirements

- **Node.js**: >= 18 (khuyến nghị v20+)
- **NPM**: >= 9
- **Trình duyệt**: Bất kỳ trình duyệt hiện đại nào trên điện thoại hoặc máy tính hỗ trợ IndexedDB & Service Worker (Chrome, Safari, Edge, Cốc Cốc, Zalo Webview).

---

## 3. Cài đặt & Khởi động nhanh (Quick Start)

Mọi thao tác phát triển và kiểm thử được thực hiện từ thư mục `web/`:

```bash
# 1. Di chuyển vào thư mục web
cd web

# 2. Cài đặt dependencies
npm install

# 3. Khởi động môi trường phát triển
npm run dev
```

Truy cập ứng dụng tại: `http://localhost:5173` (giao diện tối ưu cho kích thước màn hình điện thoại 360px–430px).

---

## 4. Chạy kiểm thử (Testing)

```bash
# Đứng tại thư mục web/
cd web

# Chạy toàn bộ test suites (Vitest)
npm test

# Chạy test ở chế độ theo dõi thay đổi (watch)
npm run test:watch
```

Bộ test bao gồm:
- **Unit test**: Bộ phân tích số lượng lâm nghiệp (`parseQuantity`: 3 vạn, 3v, 4,52 vạn, 30.000, 30,000...), kiểm tra bất biến tồn kho (`availableQuantity`, `reservedQuantity`, `batchService`, `orderService`, `undoService`).
- **Repository test**: Kiểm tra tính bền vững dữ liệu IndexedDB (ghi cơ sở -> đọc lại; khôi phục dữ liệu mẫu).
- **Integration test**: Kiểm tra các luồng màn hình Mở sổ (`/onboarding`), Hôm nay (`/today`), Danh sách lô (`/batches`), Tạo lô mới (`/batches/new`), Đơn hàng (`/orders`), Ghi đơn mới (`/orders/new`).

---

## 5. Kiểm tra chất lượng mã nguồn & Build

```bash
# Đứng tại thư mục web/
cd web

# Typecheck TypeScript (chế độ strict)
npm run typecheck

# Linter (oxlint)
npm run lint

# Production build (kèm sinh PWA service worker và manifest)
npm run build

# Preview bản build production
npm run preview
```

---

## 6. Cấu trúc ứng dụng Web (`web/src/`)

```text
web/
├── src/
│   ├── app/
│   │   ├── App.tsx          # Root application component
│   │   ├── router.tsx       # Cấu hình React Router & điều hướng bảo vệ
│   │   └── bootstrap.ts     # Khởi tạo trạng thái ban đầu từ local storage
│   │
│   ├── domain/
│   │   ├── organization.ts  # Kiểu dữ liệu Cơ sở / Vườn ươm & vai trò
│   │   ├── batch.ts         # Kiểu dữ liệu Lô cây & trạng thái sinh trưởng
│   │   ├── order.ts         # Kiểu dữ liệu Đơn hàng
│   │   ├── reservation.ts   # Kiểu dữ liệu Giữ cây cho khách
│   │   ├── shipment.ts      # Kiểu dữ liệu Chuyến giao
│   │   ├── contact.ts       # Kiểu dữ liệu Khách hàng / Vườn liên kết
│   │   └── quantity.ts      # Parser số lượng & Pure functions tính tồn/khả dụng
│   │
│   ├── services/
│   │   ├── batchService.ts  # Tạo lô, kiểm kê số lượng, tự tạo mã lô
│   │   ├── orderService.ts  # Ghi đơn hàng, kiểm tra khả dụng tồn kho
│   │   ├── contactService.ts# Tạo khách hàng, kiểm tra trùng số điện thoại
│   │   └── undoService.ts   # Quản lý hoàn tác cho các thao tác quan trọng
│   │
│   ├── data/
│   │   ├── db.ts            # Dexie schema v1
│   │   ├── repositories/    # Repository interfaces & Dexie implementations
│   │   ├── seed.ts          # Dữ liệu mẫu Vườn Hồng Anh (Hữu Lũng) & reset
│   │   └── backup.ts        # Xuất dữ liệu cục bộ ra JSON
│   │
│   ├── features/
│   │   ├── onboarding/      # Màn hình mở sổ lần đầu (/onboarding)
│   │   ├── today/           # Màn hình làm việc hôm nay (/today)
│   │   ├── batches/         # Màn hình quản lý lô cây (/batches, /batches/new, /batches/:id)
│   │   ├── orders/          # Màn hình đơn hàng (/orders, /orders/new, /orders/:id)
│   │   ├── shipments/       # Màn hình chuyến giao (/shipments, /shipments/:id)
│   │   ├── dossiers/        # Màn hình hồ sơ nguồn gốc cây giống (/dossiers/:batchId)
│   │   └── more/            # Màn hình cài đặt, chế độ & quản lý dữ liệu (/more)
│   │
│   └── shared/
│       ├── components/      # UI components (AppShell, QuantityInput, UndoBanner...)
│       └── hooks/           # useOnlineStatus...
│
├── public/                  # Favicon, icons PWA, manifest
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 7. Khả năng mở rộng kiến trúc trong tương lai

- **Backend production**: Khi bước qua giai đoạn validation thành công, backend có thể được bổ sung tại root:
  ```text
  VuonUomSo/
  ├── web/
  ├── supabase/          # Migrations, Edge Functions, config
  └── docs/
  ```
- **Mobile native shell**: Capacitor có thể đặt trực tiếp bên trong `web/` (`web/android/`, `web/ios/`, `web/capacitor.config.ts`) vì Android/iOS đóng vai trò native container cho cùng web app, không phải sản phẩm độc lập.
