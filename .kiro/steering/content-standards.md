---
inclusion: auto
description: Content standards and constants usage guidelines for all pages
---

# Content Standards — Auto-Loaded Context

**This file is automatically loaded into every conversation.**

## 📋 Quick Reference

### Constants Usage (MANDATORY)
```typescript
import { CACHE_KEYS, LABELS, MESSAGES, ENTITIES, FORMAT } from '@/constants';
```

### Cache Keys
- `CACHE_KEYS.CENTRES` — Centre data
- `CACHE_KEYS.COMPLETION` — Completion page
- `CACHE_KEYS.TEACHER_CHANGE` — Teacher change page
- `CACHE_KEYS.TICKETS` — Tickets page
- `CACHE_KEYS.CLASS_QUALITY` — Class quality page
- `CACHE_KEYS.OFFICE_HOURS` — Office hours page

### Messages
- `MESSAGES.LOADING.CONNECTING` — "Đang kết nối tới hệ thống..."
- `MESSAGES.LOADING.SUCCESS(count, entity)` — "Tải thành công x [entity]!"
- `MESSAGES.ERROR.GENERIC` — "Gặp sự cố. Vui lòng thử lại."
- `MESSAGES.CACHE.CLEARED` — "Đã xoá dữ liệu tạm!"

### Entities
- `ENTITIES.CLASSES` — "lớp học"
- `ENTITIES.TICKETS` — "phiếu đánh giá"
- `ENTITIES.OFFICE_HOURS` — "ca học"

### Format Helpers
- `FORMAT.progress(x, y)` — "x/y"
- `FORMAT.percentage(x)` — "95.7%"
- `FORMAT.date(date)` — "22/04/2026"

## 🚫 Common Mistakes to Avoid

### ❌ WRONG
```typescript
await getCache('mindx_my_page');
addToast('Đang tải dữ liệu...', 'loading');
const progress = `${x}/${y}`;
```

### ✅ RIGHT
```typescript
await getCache(CACHE_KEYS.MY_PAGE);
addToast(MESSAGES.LOADING.CONNECTING, 'loading');
const progress = FORMAT.progress(x, y);
```

## ✅ 6-Item Mechanism Checklist

Every page MUST have:
1. **Cache persistence** — Load/save from IndexedDB
2. **Progress callback** — `(loaded, total, chunk) => { ... }`
3. **Realtime display** — Show "Đang tải x/y" in Toolbar + TableGroupHeader
4. **Skeleton loading** — 8 rows while `loading && data.length === 0`
5. **TableGroupHeader** — Use component, NOT custom HTML
6. **Loading progress badge** — Automatic in TableGroupHeader

## 📝 Code Review Checklist

- [ ] Imports constants from `@/constants`
- [ ] No hardcoded strings
- [ ] Uses `CACHE_KEYS.*` for cache
- [ ] Uses `MESSAGES.*` for messages
- [ ] Uses `FORMAT.*` for formatting
- [ ] Has all 6 mechanisms

---

**Full details**: See `CONTENT_STANDARDS.md` in project root
