# ARCHIVE_CONTRACT_V0 — Deterministic Audit Log (UI Layer)

هدف هذا الأرشيف:
- تخزين قرارات المستخدم حول مسودات الـ LLM (approve/reject/simulate/publish/heavy_run)
- ذاكرة حتمية: كل حدث له hash مرتبط بالحدث السابق (prevHash)
- حذف المحادثة لا يؤثر: الأرشيف مستقل

## Event (JSON object) — v0
الحقول (مرتبة كما يلي):
- version: "archive_event_v0"
- id: string (e_<random>)
- createdAt: ISO string
- actor: string (مثلاً "rashid")
- action: "APPROVE" | "REJECT" | "SIMULATE" | "PUBLISH" | "HEAVY_RUN"
- draftId: string (مثل d_....) أو "" إذا غير موجود
- target: string (path) أو ""
- summary: string
- result:
  - status: "OK" | "FAIL"
  - note: string
- chain:
  - prevHash: string (hex) أو "GENESIS"
  - hash: string (hex)

## Hash Rule
hash = sha256( canonical_json_bytes_of_event_without_chain.hash )

- canonicalization: JSON.stringify(obj) مع ترتيب مفاتيح ثابت كما في العقد أعلاه
- لا يوجد أي بيانات حساسة
- لا يوجد أي randomness داخل payload نفسه (الـ id يمكن توليده لكن لا يدخل في الحتمية التشغيلية للمحرك)
