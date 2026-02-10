/**
 * Supabase Types
 * Minimal type definitions for admin pages (UI only - functionality disabled)
 */

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_system_role: boolean;
  created_at: string;
}

export interface Page {
  id: string;
  page_name: string;
  key: string;
  description: string | null;
}

export interface RolePermission {
  id: string;
  role_id: string;
  page_id: string;
  can_view: boolean;
  can_edit: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export interface ProfileWithPermissions extends Profile {
  role_permissions?: any[];
}
// Added proper type definitions
