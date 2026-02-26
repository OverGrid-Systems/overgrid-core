# LLM UI Surface v1 — OverGrid Third Generation

## الهدف
واجهة إدارة احترافية للـ LLM:
- المحادثة -> توليد Draft (اقتراح) فقط
- المستخدم يقرر: Approve / Reject / Simulate / Publish / Heavy Run
- حذف المحادثة لا يؤثر على الأرشيف
- ذاكرة/أرشفة حتمية: كل قرار يُحفظ كحدث مستقل

## المبادئ
- LLM = Control Plane (اقتراحات) وليس Execution Authority
- لا يوجد تنفيذ مباشر داخل core
- كل خطوة تُسجل في archive_v0 (append-only)

## الشاشات (MVP)
1) Draft Inbox
- قائمة المسودات (id, target, summary, createdAt)
- أزرار: Approve / Reject / Simulate / Details

2) Draft Detail
- عرض التغييرات المقترحة (diff أو changes[])
- عرض constraints + provenance

3) Archive / Audit Log
- قائمة الأحداث: APPROVED / REJECTED / SIMULATED / PUBLISHED / HEAVY_RUN
- كل حدث له hash + timestamp + actor

## تدفق العمل المختصر
Chat -> Draft -> Validate -> (Human Approve) -> Apply -> CI -> Archive

