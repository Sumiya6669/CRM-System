export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type CrmRole =
  | 'owner'
  | 'admin'
  | 'branch_admin'
  | 'cashier'
  | 'trainer'
  | 'warehouse_manager';

export type Database = {
  public: {
    Tables: {
      organizations: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      branches: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      profiles: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      students: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      parents: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      groups: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      trainers: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      subscriptions: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      payments: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      inventory: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      inventory_stock: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      inventory_movements: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      sales: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      attendance: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      audit_logs: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      notifications: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      student_transfers: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
      invites: { Row: Record<string, Json>; Insert: Record<string, Json>; Update: Record<string, Json> };
    };
  };
};
