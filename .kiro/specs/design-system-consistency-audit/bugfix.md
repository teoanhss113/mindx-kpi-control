# Bugfix Requirements Document

## Introduction

This bugfix addresses comprehensive design system consistency issues across the MindX KPI Dashboard. The user has lost trust after multiple claims of "design system consistency complete" that only addressed color consistency. The actual issue is much broader - there are inconsistencies across spacing, typography, borders, layout, table structure, and component patterns.

**What was already fixed:**
- ✅ Colors are 100% consistent - all hardcoded hex colors replaced with CSS variables
- ✅ Primary chart color changed from Apple Blue to Linear Indigo
- ✅ All status colors, borders, backgrounds use CSS variables

**What remains broken:**
The user explicitly stated: "Tôi không chỉ nói về hex color, về spacing, position, order, border, upper/lowercase, table column meaning, etc"

This means we need to audit and fix:
1. **Spacing violations** - hardcoded px values not using var(--space-*) or 8px grid
2. **Typography violations** - incorrect weights (should be 400/510/590), missing letter-spacing, wrong case
3. **Border violations** - inconsistent radius usage (should follow 2px/4px/6px/8px/12px/9999px scale)
4. **Layout violations** - inconsistent alignment, positioning, component order
5. **Table violations** - inconsistent column structure, labels, meanings across pages
6. **Component pattern violations** - Cards, Panels, Toolbars, Modals, Filters, Forms not following same patterns

**Scope:**
- src/app/dashboard.module.css (1479 lines - all component styles)
- src/app/page.tsx (main dashboard)
- src/app/class-quality/page.tsx
- src/app/teacher-change/page.tsx
- src/app/teacher-schedule/page.tsx
- src/app/tickets/page.tsx
- src/app/office-hours/page.tsx
- src/components/ui/index.tsx (UI components)

---

## Bug Analysis

### Current Behavior (Defect)

#### 1. Spacing Violations

1.1 WHEN reviewing dashboard.module.css THEN the system contains hardcoded px values not using var(--space-*) tokens

**Examples found:**
- `.classItemHeader { padding: 7px var(--space-4); }` — 7px is not on 8px grid
- `.reasonCheckbox { margin-top: 2px; }` — 2px is not a spacing token
- `.reasonsPreview { padding-top: 2px; }` — 2px is not a spacing token
- `.modalTitle { margin: 0 0 2px; }` — 2px is not a spacing token
- `.reasonLabel { gap: 6px; }` — 6px is not a spacing token
- `.tooltipBox { bottom: calc(100% + 8px); }` — 8px should use var(--space-2)
- `.rangeSliderWrap { gap: 5px; }` — 5px is not on 8px grid
- `.rangeThumbBubble { bottom: calc(100% + 5px); }` — 5px is not on 8px grid
- `.toast { padding: 10px var(--space-4); }` — 10px is not a spacing token
- `.chartToggle { padding: 3px 10px; }` — 3px and 10px are not spacing tokens
- `.reasonTag { padding: 2px 6px; }` — 2px and 6px are not spacing tokens
- `.statusPill { padding: 2px 8px; }` — 2px is not a spacing token
- `.suggestPill { padding: 2px var(--space-2); }` — 2px is not a spacing token
- `.groupBadge { padding: 1px 7px; }` — 1px and 7px are not spacing tokens

1.2 WHEN reviewing component spacing THEN the system uses inconsistent gap values across similar components

**Examples:**
- `.chartsGrid { gap: var(--space-4); }` but `.statsGrid { gap: var(--space-3); }`
- `.toolbarRow { gap: var(--space-3); }` but `.dateControls { gap: var(--space-2); }`
- Inconsistent padding between similar card components

1.3 WHEN reviewing layout spacing THEN the system uses magic numbers instead of spacing scale

**Examples:**
- `.hamburger { padding: 6px; }` — should use var(--space-2) or var(--space-1)
- `.chartToggle { padding: 3px 10px; }` — should use spacing tokens
- `.primaryBtn { padding: 6px var(--space-3); }` — 6px should be var(--space-2)

#### 2. Typography Violations

2.1 WHEN reviewing font weights THEN the system uses incorrect weight values not matching design system (400/510/590)

**Examples found:**
- `.groupHeader { font-weight: 590; }` — ✅ correct
- `.chartsSectionTitle { font-weight: 590; }` — ✅ correct
- `.sidebarLink { font-weight: 510; }` — ✅ correct
- `.pageTitle { font-weight: 510; }` — ✅ correct
- `.statLabel { font-weight: 510; }` — ✅ correct
- `.statValue { font-weight: 510; }` — ✅ correct
- `.reasonTag { font-weight: 510; }` — ✅ correct
- `.statusPill { font-weight: 510; }` — ✅ correct

**Note:** Font weights appear to be correct in CSS. Need to verify in component files.

2.2 WHEN reviewing letter-spacing THEN the system is missing negative letter-spacing at display sizes

**Examples:**
- `.statValue { font-size: 28px; font-weight: 510; letter-spacing: -0.704px; }` — ✅ correct
- `.pageTitle { font-size: 14px; font-weight: 510; letter-spacing: -0.182px; }` — ✅ correct
- `.chartTitle { font-size: 13px; font-weight: 510; letter-spacing: -0.13px; }` — ✅ correct

**Note:** Letter-spacing appears correct in CSS. Need to verify in component files.

2.3 WHEN reviewing text case conventions THEN the system uses inconsistent uppercase/lowercase patterns

**Examples:**
- `.statLabel { text-transform: uppercase; }` — ✅ correct for micro labels
- `.classItemHeader { text-transform: uppercase; }` — ✅ correct for table headers
- Need to verify consistency across all pages

#### 3. Border Radius Violations

3.1 WHEN reviewing border radius values THEN the system uses hardcoded px values not matching the scale (2px/4px/6px/8px/12px/9999px)

**Examples found:**
- `.modalContent { border-radius: var(--radius-panel); }` — ✅ correct (12px)
- `.modalHeader { border-radius: var(--radius-panel) var(--radius-panel) 0 0; }` — ✅ correct
- `.chartCard { border-radius: var(--radius-comfortable); }` — ✅ correct (6px)
- `.filterPanel { border-radius: var(--radius-card); }` — ✅ correct (8px)
- `.reasonCheckbox { border-radius: var(--radius-standard); }` — ✅ correct (4px)
- `.reasonTag { border-radius: var(--radius-micro); }` — ✅ correct (2px)
- `.statusPill { border-radius: var(--radius-pill); }` — ✅ correct (9999px)
- `.tooltipBox { border-radius: var(--radius-comfortable); }` — ✅ correct (6px)
- `.toast { border-radius: var(--radius-card); }` — ✅ correct (8px)

**Note:** Border radius appears correct in CSS. Need to verify in component files and inline styles.

3.2 WHEN reviewing chart bar radius THEN the system uses inconsistent radius values

**Examples:**
- `<Bar radius={[0, 4, 4, 0]} />` — ✅ correct for horizontal bars
- Need to verify consistency across all chart implementations

#### 4. Layout Violations

4.1 WHEN reviewing component alignment THEN the system uses inconsistent alignment patterns

**Examples:**
- `.classItem { align-items: start; }` — correct for wrapping content
- `.completionCol { align-items: center; }` — correct for single-line content
- Need to verify consistency across all table rows

4.2 WHEN reviewing component positioning THEN the system uses inconsistent positioning patterns

**Examples:**
- `.sidebar { position: fixed; }` — ✅ correct
- `.header { position: sticky; }` — ✅ correct
- `.modalOverlay { position: fixed; }` — ✅ correct
- Need to verify no unnecessary absolute positioning

4.3 WHEN reviewing component order THEN the system uses inconsistent order across pages

**Examples:**
- Page structure: Toolbar → Stats → Suggestions → Charts → Tables — need to verify consistency
- Table structure: Name → Centre → Progress → Status → Reasons — need to verify consistency

#### 5. Table Structure Violations

5.1 WHEN reviewing table columns across pages THEN the system uses inconsistent column meanings and labels

**Examples:**
- Main dashboard: "Lớp học" (Class Name) + "Cơ sở" (Centre) + "Sĩ số" (Size) + "Tiến độ" (Progress) + "Lý do" (Reasons)
- Class Quality: "Lớp học" + "Giáo viên" (Teacher) + "Tiến độ" + "Vi phạm" (Violations)
- Teacher Change: "Lớp học" + "Tổng buổi" (Total Sessions) + "Thay đổi" (Changes) + "Giáo viên" (Teachers)
- Need to verify if column order and meanings are consistent where they should be

5.2 WHEN reviewing table headers THEN the system uses inconsistent header styles

**Examples:**
- `.classItemHeader { font-size: 11px; font-weight: 590; text-transform: uppercase; }` — ✅ correct
- Need to verify all tables use same header style

5.3 WHEN reviewing table row structure THEN the system uses inconsistent grid templates

**Examples:**
- `.classItemHeader { grid-template-columns: minmax(0, 2.2fr) minmax(0, 1.2fr) minmax(0, 0.6fr) minmax(0, 1fr) minmax(0, 2fr); }`
- `.classItem { grid-template-columns: minmax(0, 2.2fr) minmax(0, 1.2fr) minmax(0, 0.6fr) minmax(0, 1fr) minmax(0, 2fr); }`
- Need to verify consistency across all table implementations

#### 6. Component Pattern Violations

6.1 WHEN reviewing Card components THEN the system uses inconsistent card patterns

**Examples:**
- `.statCard { background: rgba(0, 0, 0, 0.02); border: 1px solid var(--border-primary); border-radius: var(--radius-card); }` — ✅ correct
- `.chartCard { background: rgba(0, 0, 0, 0.03); border: 1px solid var(--border-primary); border-radius: var(--radius-comfortable); }` — different background opacity
- `.filterPanel { background: rgba(0, 0, 0, 0.02); border: 1px solid var(--border-primary); border-radius: var(--radius-card); }` — ✅ correct
- Need to verify why chartCard uses 0.03 instead of 0.02

6.2 WHEN reviewing Panel components THEN the system uses inconsistent panel patterns

**Examples:**
- `.chartsSection { background: rgba(0, 0, 0, 0.02); border: 1px solid var(--border-primary); border-radius: var(--radius-card); }` — ✅ correct
- `.tableSection { background: rgba(0, 0, 0, 0.02); border: 1px solid var(--border-primary); border-radius: var(--radius-card); }` — ✅ correct
- Need to verify all sections use same pattern

6.3 WHEN reviewing Toolbar components THEN the system uses inconsistent toolbar patterns

**Examples:**
- `.toolbar { background: rgba(0, 0, 0, 0.02); border: 1px solid var(--border-primary); border-radius: var(--radius-card); padding: 10px var(--space-4); }` — 10px should be var(--space-3)
- `.tableToolbar` — need to verify if exists and matches pattern

6.4 WHEN reviewing Modal components THEN the system uses inconsistent modal patterns

**Examples:**
- `.modalOverlay { background: rgba(0, 0, 0, 0.85); }` — ✅ correct per DESIGN.md
- `.modalContent { background: var(--bg-surface); border: 1px solid var(--border-primary); border-radius: var(--radius-panel); }` — ✅ correct
- `.modalHeader { padding: var(--space-4) var(--space-5); }` — ✅ correct
- Need to verify all modals use same pattern

6.5 WHEN reviewing Filter components THEN the system uses inconsistent filter patterns

**Examples:**
- `.filterChip { background: rgba(0, 0, 0, 0.02); border: 1px solid var(--border-input); border-radius: var(--radius-pill); padding: 6px var(--space-3); }` — 6px should be var(--space-2)
- `.multiDropdownTrigger { background: rgba(0, 0, 0, 0.02); border: 1px solid var(--border-input); border-radius: var(--radius-comfortable); padding: 6px var(--space-2); }` — 6px should be var(--space-2)
- Need to verify consistency

6.6 WHEN reviewing Form components THEN the system uses inconsistent form patterns

**Examples:**
- `.dateInput { background: rgba(0, 0, 0, 0.02); border: 1px solid var(--border-input); padding: 5px var(--space-2); border-radius: var(--radius-comfortable); }` — 5px should be var(--space-1) or var(--space-2)
- `.filterInput { background: rgba(0, 0, 0, 0.02); border: 1px solid var(--border-input); padding: 6px var(--space-2) 6px 30px; border-radius: var(--radius-comfortable); }` — 6px should be var(--space-2)
- Need to verify consistency

---

### Expected Behavior (Correct)

#### 1. Spacing Consistency

2.1 WHEN using spacing values THEN the system SHALL use only var(--space-*) tokens from the 8px grid system

**Spacing scale:**
- var(--space-1): 4px — Micro spacing
- var(--space-2): 8px — Base unit
- var(--space-3): 12px — Comfortable
- var(--space-4): 16px — Standard
- var(--space-5): 20px — Generous
- var(--space-6): 24px — Large
- var(--space-8): 32px — Extra large

2.2 WHEN applying padding/margin THEN the system SHALL use spacing tokens consistently across similar components

**Examples:**
- All card components SHALL use same padding pattern
- All button components SHALL use same padding pattern
- All input components SHALL use same padding pattern

2.3 WHEN using gap values THEN the system SHALL use spacing tokens consistently

**Examples:**
- All grid layouts SHALL use consistent gap values
- All flex layouts SHALL use consistent gap values

#### 2. Typography Consistency

2.4 WHEN using font weights THEN the system SHALL use only 400 (Regular), 510 (Signature emphasis), or 590 (Strong emphasis)

**Weight usage:**
- 400: Body text, reading content
- 510: UI labels, navigation, headings, emphasis
- 590: Strong emphasis, h3, important labels

2.5 WHEN using font sizes ≥20px THEN the system SHALL apply negative letter-spacing per DESIGN.md scale

**Letter-spacing scale:**
- 32px (h1): -0.704px
- 24px (h2): -0.288px
- 20px (h3): -0.24px
- 14px (body): -0.13px
- 13px (caption): -0.13px

2.6 WHEN using text case THEN the system SHALL follow consistent conventions

**Case conventions:**
- Micro labels (11px): UPPERCASE with letter-spacing: 0.04em
- Table headers: UPPERCASE with letter-spacing: 0.04em
- All other text: Sentence case or Title Case as appropriate

#### 3. Border Radius Consistency

2.7 WHEN using border radius THEN the system SHALL use only values from the radius scale

**Radius scale:**
- var(--radius-micro): 2px — Inline badges, toolbar buttons
- var(--radius-standard): 4px — Small containers, list items
- var(--radius-comfortable): 6px — Buttons, inputs, functional elements
- var(--radius-card): 8px — Cards, dropdowns, popovers
- var(--radius-panel): 12px — Panels, featured cards, sections
- var(--radius-pill): 9999px — Chips, filter pills, status tags, circles

2.8 WHEN using chart bar radius THEN the system SHALL use [0, 4, 4, 0] for horizontal bars

**Chart radius:**
- Horizontal bars: radius={[0, 4, 4, 0]} — rounded right corners
- Vertical bars: radius={[4, 4, 0, 0]} — rounded top corners

#### 4. Layout Consistency

2.9 WHEN structuring pages THEN the system SHALL follow consistent page layout order

**Page structure:**
1. Toolbar (date range, centre selection, fetch controls)
2. Stats Grid (4 stat cards with staggered animation)
3. Suggestions Bar (optional, for KPI targets/warnings)
4. Charts Section (collapsible, 2-col grid on desktop)
5. Table Section (with filters, sorting, grouping)

2.10 WHEN aligning components THEN the system SHALL use consistent alignment patterns

**Alignment patterns:**
- Table rows with wrapping content: align-items: start
- Table rows with single-line content: align-items: center
- Flex containers with icons: align-items: center

2.11 WHEN positioning components THEN the system SHALL use consistent positioning patterns

**Positioning patterns:**
- Sidebar: position: fixed
- Header: position: sticky
- Modals: position: fixed with overlay
- Dropdowns: position: absolute
- No unnecessary absolute positioning

#### 5. Table Structure Consistency

2.12 WHEN structuring table columns THEN the system SHALL use consistent column order and meanings across pages

**Common columns:**
- "Lớp học" (Class Name) — always first column, includes centre name as subtitle
- "Giáo viên" (Teacher) — when relevant, shows primary teacher
- "Tiến độ" (Progress) — shows completed/total sessions
- "Trạng thái" (Status) — shows class status or completion status
- Page-specific columns — clearly labeled and consistently positioned

2.13 WHEN styling table headers THEN the system SHALL use consistent header style

**Header style:**
- font-size: 11px
- font-weight: 590
- color: var(--text-quaternary)
- text-transform: uppercase
- letter-spacing: 0.04em
- background: var(--bg-elevated)

2.14 WHEN structuring table rows THEN the system SHALL use consistent grid templates

**Grid template:**
- Use minmax(0, Xfr) to prevent overflow
- Consistent column proportions for similar content types
- Consistent min-width for horizontal scroll on mobile

#### 6. Component Pattern Consistency

2.15 WHEN creating Card components THEN the system SHALL use consistent card pattern

**Card pattern:**
- background: rgba(0, 0, 0, 0.02)
- border: 1px solid var(--border-primary)
- border-radius: var(--radius-card)
- padding: var(--space-4) var(--space-5) (for stat cards)
- padding: var(--space-3) (for chart cards)
- box-shadow: var(--shadow-card)

2.16 WHEN creating Panel components THEN the system SHALL use consistent panel pattern

**Panel pattern:**
- background: rgba(0, 0, 0, 0.02)
- border: 1px solid var(--border-primary)
- border-radius: var(--radius-card)
- overflow: hidden (for sections with internal scroll)
- box-shadow: var(--shadow-card)

2.17 WHEN creating Toolbar components THEN the system SHALL use consistent toolbar pattern

**Toolbar pattern:**
- background: rgba(0, 0, 0, 0.02)
- border: 1px solid var(--border-primary)
- border-radius: var(--radius-card)
- padding: var(--space-3) var(--space-4)
- box-shadow: var(--shadow-card)
- margin-bottom: var(--space-4)

2.18 WHEN creating Modal components THEN the system SHALL use consistent modal pattern

**Modal pattern:**
- Overlay: background: rgba(0, 0, 0, 0.85)
- Content: background: var(--bg-surface), border-radius: var(--radius-panel)
- Header: padding: var(--space-4) var(--space-5), background: var(--bg-elevated)
- Body: padding varies by content, overflow-y: auto

2.19 WHEN creating Filter components THEN the system SHALL use consistent filter pattern

**Filter pattern:**
- Chips: padding: var(--space-2) var(--space-3), border-radius: var(--radius-pill)
- Dropdowns: padding: var(--space-2), border-radius: var(--radius-comfortable)
- Inputs: padding: var(--space-2), border-radius: var(--radius-comfortable)

2.20 WHEN creating Form components THEN the system SHALL use consistent form pattern

**Form pattern:**
- Inputs: padding: var(--space-2), border-radius: var(--radius-comfortable)
- Buttons: padding: var(--space-2) var(--space-3), border-radius: var(--radius-comfortable)
- Labels: font-size: 13px, font-weight: 510, color: var(--text-tertiary)

---

### Unchanged Behavior (Regression Prevention)

#### 1. Color System Preservation

3.1 WHEN using colors THEN the system SHALL CONTINUE TO use CSS variables exclusively

**Color variables:**
- All backgrounds use var(--bg-*)
- All text uses var(--text-*)
- All borders use var(--border-*)
- All status colors use var(--status-*)
- Brand indigo: var(--brand-indigo)

3.2 WHEN using chart colors THEN the system SHALL CONTINUE TO use Linear Indigo as primary

**Chart colors:**
- Primary: #5e6ad2 (Linear Indigo)
- Secondary palette: CHART_COLORS.SECONDARY from constants
- KPI colors: KPI_COLORS from kpiScoring.ts

#### 2. Functionality Preservation

3.3 WHEN users interact with components THEN the system SHALL CONTINUE TO function identically

**Preserved functionality:**
- All filters work correctly
- All sorting works correctly
- All modals open/close correctly
- All charts render correctly
- All tables scroll correctly
- All animations play correctly

3.4 WHEN users navigate pages THEN the system SHALL CONTINUE TO navigate correctly

**Preserved navigation:**
- Sidebar navigation works
- Page routing works
- Authentication works
- Data fetching works

#### 3. Responsive Behavior Preservation

3.5 WHEN viewing on mobile THEN the system SHALL CONTINUE TO be responsive

**Preserved responsive:**
- Sidebar collapses to drawer
- Tables scroll horizontally
- Charts stack vertically
- Modals adapt to viewport
- Spacing reduces appropriately

3.6 WHEN viewing on desktop THEN the system SHALL CONTINUE TO use full layout

**Preserved desktop:**
- Sidebar fixed left
- Header sticky top
- Charts 2-column grid
- Tables full width
- Modals centered

#### 4. Performance Preservation

3.7 WHEN loading pages THEN the system SHALL CONTINUE TO load efficiently

**Preserved performance:**
- No additional re-renders
- No additional network requests
- No additional memory usage
- Same animation performance

3.8 WHEN filtering/sorting data THEN the system SHALL CONTINUE TO perform efficiently

**Preserved data operations:**
- Same filtering speed
- Same sorting speed
- Same search speed
- Same cache behavior

#### 5. Accessibility Preservation

3.9 WHEN using keyboard navigation THEN the system SHALL CONTINUE TO be keyboard accessible

**Preserved keyboard:**
- Tab order works
- Focus states visible
- Escape closes modals
- Enter submits forms

3.10 WHEN using screen readers THEN the system SHALL CONTINUE TO be screen reader accessible

**Preserved screen reader:**
- Semantic HTML preserved
- ARIA labels preserved
- Alt text preserved
- Role attributes preserved
