# Bugfix Requirements Document

## Introduction

The Roles admin page (`src/app/admin/roles/page.tsx`) has design inconsistencies compared to the Users and Regions admin pages. The page uses inline styles for modals instead of CSS module classes, doesn't use the `AdminTableSection` wrapper component, and has inconsistent form field styling. This violates the design system's requirement that all admin pages must follow the same visual structure and use reusable components.

**Impact:** Visual inconsistency across admin pages, harder maintenance, violation of design system standards.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the Roles page modal is rendered THEN the system uses inline styles (`backgroundColor`, `borderRadius`, `padding`, etc.) instead of CSS module classes (`styles.modalOverlay`, `styles.modalContent`, `styles.modalHeader`)

1.2 WHEN the Roles page table is rendered THEN the system wraps the table in a plain `<div>` instead of using the `AdminTableSection` component wrapper

1.3 WHEN form fields are rendered in the Roles page modal THEN the system uses inconsistent label styles (different `fontSize`, `fontWeight`, `color`, `marginBottom` values) compared to Users/Regions pages

1.4 WHEN the modal close button is rendered THEN the system uses inline button styles instead of the `styles.closeModalBtn` class

1.5 WHEN textarea fields are rendered THEN the system uses inconsistent styling (different `minHeight`, `resize` properties) compared to Users/Regions pages

### Expected Behavior (Correct)

2.1 WHEN the Roles page modal is rendered THEN the system SHALL use CSS module classes (`styles.modalOverlay`, `styles.modalContent`, `styles.modalHeader`, `styles.modalTitle`, `styles.modalSubtitle`) from `dashboard.module.css`

2.2 WHEN the Roles page table is rendered THEN the system SHALL wrap the table in the `AdminTableSection` component with `title`, `count`, `loading`, `isExpanded`, and `onToggle` props

2.3 WHEN form fields are rendered in the Roles page modal THEN the system SHALL use consistent label styles matching Users/Regions pages: `fontSize: 13`, `fontWeight: 510`, `color: 'var(--text-primary)'`, `marginBottom: 'var(--space-2)'`

2.4 WHEN the modal close button is rendered THEN the system SHALL use the `styles.closeModalBtn` class with the standard SVG icon structure

2.5 WHEN textarea fields are rendered THEN the system SHALL use the `styles.dateInput` class with consistent styling: `resize: 'vertical'`, `fontFamily: 'inherit'`

2.6 WHEN input fields are rendered THEN the system SHALL use the `styles.dateInput` class with `width: '100%'` for consistency

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the Roles page form is submitted THEN the system SHALL CONTINUE TO validate and save role data correctly

3.2 WHEN the Roles page loads data THEN the system SHALL CONTINUE TO fetch roles and pages from the API correctly

3.3 WHEN the Roles page filters/sorts data THEN the system SHALL CONTINUE TO apply search and sort operations correctly

3.4 WHEN the Roles page deletes a role THEN the system SHALL CONTINUE TO show confirmation and delete the role correctly

3.5 WHEN the MultiSelect component is used for page permissions THEN the system SHALL CONTINUE TO handle selection state correctly

3.6 WHEN the Users and Regions pages are rendered THEN the system SHALL CONTINUE TO use their existing correct modal and table patterns without changes
