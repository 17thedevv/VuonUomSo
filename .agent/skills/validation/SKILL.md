---
name: validation
description: >-
  Field validation and evidence rules for Vườn Ươm. Keeps pilot evidence,
  product learning, and V3 technical authorization as separate gates.
---

# Product Validation & Evidence Discipline

## 1. Purpose

Ngăn agent suy diễn “demo chạy được” thành “đã chứng minh sản phẩm” hoặc “có roadmap V3” thành “pilot đã GO”.

Validation trả lời câu hỏi **người dùng thật có dùng và nhận giá trị không**. Architecture/implementation authorization trả lời câu hỏi **team được phép xây phase nào**. Hai gate này liên quan nhưng không thay thế nhau.

## 2. Evidence hierarchy

Từ yếu đến mạnh:

1. lời khen;
2. thử dữ liệu giả;
3. người dùng tự nhập dữ liệu thật;
4. quay lại dùng nhiều ngày/giao dịch;
5. giới thiệu người khác;
6. willingness-to-pay/paid use.

Browser test, CI, staging demo là **technical evidence**, không phải field validation.

## 3. Historical pilot status

Historical real pilot vẫn giữ trạng thái trong PROJECT_STATE và các report tương ứng. Không upgrade gate chỉ vì:

- V3 cloud architecture đã được design;
- app deploy được lên cloud;
- login hoạt động;
- demo môn học thành công;
- browser/device synthetic checks pass.

Pilot GO/NO-GO cần evidence/gate riêng.

## 4. V3 relationship

V3 product direction đã được owner chấp thuận ở mức roadmap/design. Vì vậy skill này **không được** dùng rule cũ “chưa đủ WTP thì cấm mọi cloud/backend design”.

Ngược lại:

- V3-0 design được phép theo PROJECT_STATE.
- V3-1+ implementation vẫn cần authorization riêng.
- Production launch/real users cần privacy/security/recovery/operational gates tương ứng.
- Field evidence tiếp tục ảnh hưởng priority và feature expansion.

## 5. Course boundary

Course snapshot/deployment không phải pilot.

Không được ghi:

`deployed on public cloud → validated by users`

nếu không có evidence người dùng thật.

## 6. Checklist

- [ ] Claim này là technical evidence hay user evidence?
- [ ] Có đang nâng pilot status từ CI/demo không?
- [ ] Có đang dùng historical pilot gate để phủ quyết một owner-approved V3 design task không?
- [ ] Có đang dùng V3 roadmap để tự mở real pilot không?
- [ ] Evidence có source/time/device/user context đủ rõ không?
