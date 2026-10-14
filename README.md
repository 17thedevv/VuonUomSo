# Vườn Ươm — Sổ cây giống trên điện thoại

> **Project status: HIBERNATED / DEVELOPMENT PAUSED — 2026-10-14**
>
> Vườn Ươm đã chứng minh được giá trị ở mức **product/internal tool**: mô hình nghiệp vụ lô cây, tồn kho khả dụng, giữ chỗ, đơn hàng, giao hàng, hồ sơ lô, backup và offline-first có thể giải quyết một bài toán vận hành thực tế.
>
> Tuy nhiên, **commercial SaaS thesis hiện chưa được validate**. Việc tiếp tục mở rộng thành một SaaS production-grade sẽ kéo theo thêm tenancy, sync, billing, support, security/privacy operations, migration, native distribution và customer acquisition trong khi willingness-to-pay/ROI thương mại chưa có đủ bằng chứng.
>
> Vì vậy dự án được **tạm dừng có chủ đích tại một checkpoint sạch**, không phải do lỗi kỹ thuật hay thiếu khả năng hoàn thiện. Phần SaaS chỉ nên được mở lại khi xuất hiện bằng chứng thị trường đủ mạnh hoặc nhu cầu vận hành thực tế mới.

---

## 1. Checkpoint hiện tại

### Đã hoàn thành

- **V3-1A — Server Foundation**: DONE / CLOSED qua PR #64.
  - NestJS + Express
  - Prisma 7 + PostgreSQL foundation
  - JWT/JWKS authentication
  - `/v3/me` bootstrap/profile
  - structured logging, request ID, throttling
  - OpenAPI generation/check
- **V3-1B — Auth Client Foundation**: DONE / CLOSED qua PR #65.
  - Supabase Auth client
  - login/signup/logout
  - password recovery
  - Bearer-token API wrapper
  - 401 re-auth handling
  - client installation ID
  - web/server CI green tại thời điểm closure

### Chưa bắt đầu / không được tiếp tục tự động

- **V3-1C — Tenancy and Device Server**: NOT STARTED.
- **V3-1D — Tenant Onboarding Client**: NOT STARTED.
- **V3-1E — Membership / Invitations**: NOT STARTED.
- **V3-2+ — Server Domain, Migration Cutover, Offline Sync**: NOT AUTHORIZED.
- Production cloud provisioning, live tenant migration và real tenant data: NOT AUTHORIZED.
- Real pilot: NOT STARTED.

Không tự động tiếp tục roadmap chỉ vì các phase trước đã hoàn thành.

---

## 2. Vì sao dự án được pause

Bài toán sản phẩm có giá trị, nhưng bài toán kinh doanh chưa được chứng minh.

Một công cụ local/internal có thể tạo ROI ngay nếu nó giảm sai sót và tiết kiệm thời gian. Nhưng khi chuyển thành SaaS, hệ thống phải gánh thêm:

- multi-tenant authorization;
- cloud sync và conflict handling;
- billing/subscription;
- backup/recovery;
- security và privacy operations;
- customer onboarding/support;
- monitoring/incident response;
- native Android/iOS distribution;
- customer acquisition và churn management.

Ở checkpoint hiện tại chưa có đủ bằng chứng rằng số lượng khách hàng sẵn sàng trả tiền và ARPU có thể biện minh cho toàn bộ complexity trên.

Quyết định pause vì vậy là một **product/business decision dựa trên thông tin thu được sau quá trình implementation**, không phải đánh giá rằng codebase hay ý tưởng nghiệp vụ không có giá trị.

---

## 3. Điều kiện hợp lý để cân nhắc mở lại

Dự án có thể được xem xét tiếp tục nếu xuất hiện ít nhất một tín hiệu mới đủ mạnh, ví dụ:

- có một nhóm vườn ươm ngoài người phát triển thực sự muốn sử dụng;
- có khách hàng sẵn sàng trả tiền, không chỉ phản hồi tích cực;
- nhu cầu multi-device/multi-user/cloud sync xuất hiện rõ trong sử dụng thực tế;
- có business model tốt hơn subscription SaaS giá thấp;
- nhu cầu nội bộ phát triển tới mức cloud collaboration thực sự cần thiết.

Khi mở lại, câu hỏi đầu tiên không phải là “tiếp tục V3-1C ở đâu”, mà là:

> **Mức nhỏ nhất của Vườn Ươm mà một người dùng bên ngoài thực sự sẵn sàng trả tiền là gì?**

Architecture tiếp theo phải đi theo câu trả lời đó.

---

## 4. Trạng thái kiến trúc tại checkpoint

Repository hiện chứa hai lớp chính:

```text
VuonUomSo/
├── web/          # React/Vite PWA, business UI, Dexie/local data, Supabase auth client
├── server/       # NestJS V3 cloud foundation
├── docs/         # Product, domain, architecture, API, migration & validation docs
├── .agent/       # Project state, agent rules & implementation guidance
├── .github/      # CI workflows
├── AGENTS.md
├── LICENSE
└── README.md
```

### Local/business layer

Phần nghiệp vụ ban đầu được xây theo hướng local/offline-first với Dexie/IndexedDB:

- organizations/settings;
- contacts;
- batches;
- orders;
- reservations;
- shipments;
- dossiers;
- events/audit-compatible history;
- Backup V1 export.

Cloud migration/cutover cho business data **chưa được hoàn thành**. Không có real tenant business data nào được phép coi là đã migration production.

### V3 cloud foundation

V3 đã có server/auth foundation nhưng chưa có đầy đủ tenancy, membership, domain cloud authority hay production sync.

Nói cách khác:

```text
Product/domain implementation: substantial
Cloud foundation: partial
Production SaaS platform: incomplete by design
Commercial validation: not proven
```

---

## 5. Requirements

- **Node.js**: >= 22.22.2
- **npm**: phiên bản tương thích Node 22
- Trình duyệt hiện đại hỗ trợ IndexedDB và Service Worker cho web/PWA.

---

## 6. Chạy Web/PWA

```bash
cd web
npm install
npm run dev
```

Ứng dụng phát triển mặc định chạy qua Vite.

Quality gates:

```bash
cd web

npm run typecheck
npm run lint
npm test
npm run api:check
npm run build
```

---

## 7. Chạy Server V3

Server chỉ là **cloud foundation tại checkpoint hiện tại**, không phải production SaaS hoàn chỉnh.

```bash
cd server
npm install

npm run typecheck
npm run lint
npm test
npm run prisma:validate
npm run openapi:check
npm run build
```

Các runtime environment variables và database/auth configuration phải tuân theo tài liệu V3 trong `docs/architecture/`. Không dùng production secrets cho local development/test.

---

## 8. Các invariant nghiệp vụ đáng giữ lại

Dù commercial SaaS direction đang pause, phần domain model vẫn là tài sản quan trọng của project:

- **stock != availability**;
- availability phải trừ active outstanding reservations;
- fulfilled quantity và outstanding commitment là hai khái niệm khác nhau;
- external supply không được tính như own physical stock;
- tạo order không tự động reserve;
- planned shipment không đồng nghĩa đã xuất hàng;
- chỉ confirmed/completed own-source shipment mới làm giảm own stock;
- undo/audit phải giữ semantics có thể kiểm chứng;
- local backup và migration phải fail closed, không silent cutover.

Các invariant này nên được giữ nếu codebase được tái sử dụng cho một sản phẩm khác.

---

## 9. Nếu chỉ dùng như internal/local tool

Đây vẫn là một outcome hợp lệ.

Không cần hoàn thiện toàn bộ SaaS roadmap để tiếp tục dùng hoặc phát triển những phần tạo giá trị trực tiếp cho chính người vận hành. Có thể giữ repository như:

- personal/internal nursery operations tool;
- domain/reference implementation;
- nền tảng để thử các workflow mới;
- portfolio/reference cho offline-first, auth, audit và domain modeling.

Không có yêu cầu phải hoàn tất multi-tenant SaaS chỉ để “kết thúc” project.

---

## 10. License

Vườn Ươm được phát hành theo **GNU Affero General Public License v3.0** (`AGPL-3.0-only`).

Xem [LICENSE](./LICENSE).
