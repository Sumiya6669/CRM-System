import { getSupabaseClient, runSupabaseQuery } from '@/lib/supabase';

export const OWNER_RECORD_TYPES = {
  PRODUCT: 'inventory',
  PAYMENT: 'payments',
  SALE: 'sales',
  INVENTORY_MOVEMENT: 'inventory_movements',
  INVENTORY_RECEIPT: 'inventory_receipts',
  STOCK_ADJUSTMENT: 'stock_adjustments',
  STUDENT: 'students',
  ATTENDANCE: 'attendance',
  SUBSCRIPTION: 'subscriptions',
  STUDENT_TRANSFER: 'student_transfers',
};

const runOwnerAction = (table, id, action, reason) => {
  return runSupabaseQuery(
    `owner.${table}.${action}`,
    getSupabaseClient().rpc('owner_manage_record', {
      p_table: table,
      p_record_id: id,
      p_action: action,
      p_reason: reason || null,
    })
  );
};

export const ownerActionsService = {
  listDeletedRecords() {
    return runSupabaseQuery('owner.recycleBin.list', getSupabaseClient().rpc('owner_list_deleted_records'));
  },

  run: runOwnerAction,
  archive: (table, id, reason) => runOwnerAction(table, id, 'archive', reason),
  unarchive: (table, id, reason) => runOwnerAction(table, id, 'unarchive', reason),
  softDelete: (table, id, reason) => runOwnerAction(table, id, 'delete', reason),
  restore: (table, id, reason) => runOwnerAction(table, id, 'restore', reason),
  permanentDelete: (table, id, reason) => runOwnerAction(table, id, 'permanent_delete', reason),
  unlock: (table, id, reason) => runOwnerAction(table, id, 'unlock', reason),
  reopen: (table, id, reason) => runOwnerAction(table, id, 'reopen', reason),
  repost: (table, id, reason) => runOwnerAction(table, id, 'repost', reason),
  recalculate: (table, id, reason) => runOwnerAction(table, id, 'recalculate', reason),
};
