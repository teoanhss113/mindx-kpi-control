---
inclusion: auto
description: MindX KPI Dashboard project context and structure
---

# MindX KPI Dashboard — Project Context

**This file is automatically loaded into every conversation.**

## 🎯 Project Overview

Dashboard quản lý KPI cho MindX Education với 5 pages:
1. **Completion** (`/`) — Tỷ lệ Hoàn thành
2. **Teacher Change** (`/teacher-change`) — Tỷ lệ Thay đổi GV
3. **Tickets** (`/tickets`) — Quản lý Phiếu đánh giá
4. **Class Quality** (`/class-quality`) — Kiểm soát Chất lượng
5. **Office Hours** (`/office-hours`) — Quản lý Ca trải nghiệm

## 📁 Key Directories

```
src/
├── app/                    # Pages (Next.js App Router)
├── components/ui/          # Shared UI components
├── constants/index.ts      # ⭐ Single source of truth
├── services/              # API services (GraphQL)
├── types/                 # TypeScript types
└── lib/                   # Utilities (idb, auth, etc.)
```

## 🔑 Critical Files

- **`src/constants/index.ts`** — ALL constants (CACHE_KEYS, MESSAGES, etc.)
- **`src/components/ui/index.tsx`** — Shared components (Toolbar, TableGroupHeader, etc.)
- **`src/lib/idb.ts`** — IndexedDB cache utilities
- **`src/services/lmsClient.ts`** — GraphQL client

## ✅ All Pages Are Synchronized

- ✅ Same 6 mechanisms
- ✅ Same constants usage
- ✅ Same UI patterns
- ✅ No hardcoded strings

## 🚀 Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Framer Motion
- Recharts
- IndexedDB (idb)

---

**Full details**: See `README.md` in project root
