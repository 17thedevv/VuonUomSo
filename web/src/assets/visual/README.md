# Vườn Ươm Số — Visual Asset Kit v1.0

Bộ asset khởi tạo dành cho web app quản lý vườn ươm. Thiết kế thiên về **quản lý vận hành**: rõ ràng, tin cậy, dễ đọc trên điện thoại và desktop; hình minh họa được giữ đơn giản, tránh phong cách app chơi cây cảnh.

## Cấu trúc

- `brand/`: logo SVG theo các biến thể, favicon SVG/ICO, app icon SVG và PNG (48, 96, 180, 192, 512px).
- `icons/`: 29 icon nghiệp vụ SVG 24×24 có `currentColor` (đổi màu theo CSS).
- `illustrations/`: 8 minh họa empty state SVG + PNG 640×420, không chứa chữ để dễ tùy biến UI/i18n.
- `onboarding/`: 3 minh họa onboarding SVG + PNG 880×620.
- `placeholders/`: 6 ảnh thay thế danh mục cây SVG + PNG 500×320.
- `marketing/`: hình hero 1200×720 và ảnh Open Graph 1200×630 (SVG + PNG).
- `tokens/`: mã màu và design token đề xuất (JSON/CSS); `icon-map.ts` là map đường dẫn mẫu.

## Triết lý gắn với nghiệp vụ

- **Availability/sẵn bán** là luồng chính. UI tập trung trình bày danh sách cây và tình trạng bán được, không trộn vào hao hụt.
- **Hao hụt** có biểu tượng riêng, không dùng cùng icon với hàng sẵn bán.
- **Công nợ/thanh toán** tách khỏi giao/ xuất cây, không dùng một chỉ báo chung cho hai trạng thái.
- **Bảng hàng chia sẻ** là ảnh minh họa về bản snapshot thủ công, *không hàm ý* public live link hay tự động publish.
- Đây là **tài sản thiết kế v1**, không phải mockup xác nhận logic hay tính năng đã được triển khai.

## Dùng trong dự án React/Vite

1. Chép nội dung thư mục `brand`, `icons`, `illustrations`, `onboarding`, `placeholders`, `marketing` vào `web/public/assets/vuonuom/`.
2. Import `tokens/brand-tokens.css` trong `web/src/index.css` nếu cần dùng token mới. Nên đối chiếu với token đang có trước khi ghi đè.
3. Dùng icon bằng `<img src="/assets/vuonuom/icons/availability.svg" alt="" aria-hidden="true" />`. **Lưu ý:** `currentColor` trong SVG dùng qua thẻ `<img>` không kế thừa màu của CSS cha; để đổi theo text color, import SVG dưới dạng component hoặc dùng `mask-image`.
4. Logo website: `brand/logo-horizontal.svg`; nav mobile: `brand/mark.svg`; icon PWA: `brand/app-icon-192.png` và `brand/app-icon-512.png`.
5. Ảnh chia sẻ: `marketing/og-cover.png`, kích thước 1200×630; cập nhật URL tuyệt đối của website trong metadata.

## Quy chuẩn

- Màu chính forest `#163E33`, màu hành động pine `#246C4D`, accent leaf `#48A878`; kem `#F8F7F0` cho nền.
- Text chính `#21342F`, text phụ `#667A72`. Đừng chỉ dùng màu để biểu thị trạng thái; luôn có nhãn chữ.
- Không nhúng màu đỏ cho trạng thái hao hụt mặc định (hao hụt có thể là hạch toán bình thường, không nhất thiết là cảnh báo).
- Dùng SVG làm file gốc. PNG là bản xuất để hỗ trợ giao diện/marketing.
- Font không được đóng gói kèm (browser sẽ fallback `Inter`/`Noto Sans`).

## Những điều chưa làm

Chưa thêm ảnh chụp cây thật, ảnh từng SKU, ảnh cửa hàng cụ thể hoặc dữ liệu danh mục thật. Chưa chỉnh mã nguồn repo vì repo chưa được cung cấp trong phiên này. Logo/thiết kế là phương án mới, cần đối chiếu nhận diện hiện hữu trước khi thay thế bản chính thức.
