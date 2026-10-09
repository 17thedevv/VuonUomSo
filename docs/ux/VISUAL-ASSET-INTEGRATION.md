# Visual Asset Kit v1 — Integration

Ngày: 09/10/2026. Base `main = 0d8d97a`; branch `codex/integrate-visual-assets`. User yêu cầu tích hợp ZIP đã chép vào repository. Đây là patch hình ảnh trên flows hiện có, không triển khai Garden V2, FC5 hoặc financial/public capabilities.

## Source và nơi lưu

- Archive: `VuonUomSo-Visual-Assets-v1.zip`, giữ trên máy và ignore để không commit cả ZIP lẫn bản giải nén.
- Toàn bộ kit được giữ tại `web/src/assets/visual/`, gồm brand, 29 icons, illustrations, onboarding, placeholders, marketing và tokens. `manifest.json`/README/icon-map trong kit là tài liệu nguồn; paths `/assets/vuonuom/...` trong map mẫu không phải runtime paths của bản tích hợp này.
- Runtime map: `web/src/shared/assetIcons.ts`, `visualAssets.ts`. Vite URL imports; SVG dùng được trong build/offline bundle. `AssetIcon` dùng CSS mask để inherit currentColor, không thêm SVG loader/dependency.
- Không copy toàn kit vào public/precache. PNG marketing/placeholder và assets cho tính năng chưa mở vẫn là source library; chỉ assets import vào app được bundle. Chưa có ảnh thật từng lô, không gán placeholder thành bằng chứng về giống/size/tồn kho.

## Mapping đang dùng

| Asset | Surface |
|---|---|
| `brand/mark.svg` | Onboarding và DesktopNav; giữ HTML tên **Vườn Ươm** + descriptor hiện có |
| `brand/favicon.svg`, `favicon.ico` | Browser tab icons trong `web/public/` |
| `brand/apple-touch-icon.png`, `app-icon-192.png`, `app-icon-512.png` | Apple/PWA icons; manifest và HTML link đúng file/dimensions |
| `icons/calendar.svg`, `lot.svg`, `checklist.svg` | Hôm nay/Lô cây/Đơn hàng, giữ bốn tabs/labels/routes. Thêm giữ icon dấu ba chấm hiện có |
| `onboarding/inventory.svg` | Minh họa desktop onboarding; không đẩy form/CTA xuống thêm trên mobile |
| `illustrations/empty-catalog.svg` | Today chưa có lô + Batches chưa có dữ liệu |
| `illustrations/empty-orders.svg` | Orders chưa có dữ liệu |
| `illustrations/empty-no-results.svg` | Bộ lọc lô/đơn không có kết quả |
| `tokens/brand-tokens.css` | Import các biến `--vus-*`; giữ font/layout/CTA styles hiện có. Theme color favicon/PWA dùng forest `#163e33` |

`empty-availability` có typed mapping sẵn nhưng chưa dùng làm Garden UI. Các minh họa customer/quote/debt/offline/share, wordmark có chữ “Vườn Ươm Số”, marketing và category placeholders được giữ làm library; không mở màn hình hoặc đổi brand từ việc có asset. 29 icons có typed URL map, chỉ ba icons được render ở nav hiện tại.

Ảnh/icon trang trí có `alt=""`/`aria-hidden`; nhãn và action text vẫn là HTML. `EmptyState` giữ icon fallback cho các màn hình khác. Không thay domain/service/schema, formulas, mutation, backup hoặc Undo.

## Verification

- Typecheck, lint PASS; full suite **53 files / 723 tests PASS** từ `web/`. Không thêm tests chỉ để assert styling.
- Production build PASS; **16 PWA precache entries**. Static kiểm PNG sizes/icon links/manifest và bundle inclusion; không thêm mọi asset chưa dùng vào precache.
- Browser: onboarding 360/390/430/1280px; mark/inventory tải được, minh họa desktop không làm mobile dài thêm. Main navigation/order filter giữ labels/links, CSS mask inherit màu active/inactive.
- Fixture riêng render bốn `EmptyState` variants trong AppShell tại360/390/430/1280: tất cả image load, nav icons20×20, không overflow. Fixture không ghi stock/order và không được commit hoặc ship thành route.
- Screenshot local: `C:/Users/84387/.codex/visualizations/2026/10/08/01a118d2-9ada-77a1-9a4d-486bfcee630c/asset-integration/`: `onboarding-1280.png`, `onboarding-430.png`, `empty-states-360.png`, `empty-states-1280.png`. Không coi ảnh fixture là acceptance của Garden/customer/payment UI.
- Installed-PWA/physical IME/offline thực tế chưa được kiểm bằng patch này. Full CI exact head cần xanh trước merge; không thay phase hoặc nghiệm thu roadmap từ asset integration.
