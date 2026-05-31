import { getSupabaseClient, runSupabaseQuery } from '@/lib/supabase';

const allowedTables = new Set([
  'payments',
  'sales',
  'inventory_movements',
  'inventory_receipts',
  'stock_adjustments',
]);

const table = (tableName) => {
  if (!allowedTables.has(tableName)) {
    throw new Error('Unsupported document type');
  }
  return getSupabaseClient().from(tableName);
};

export const documentService = {
  unlock(tableName, id) {
    return runSupabaseQuery(`documents.${tableName}.unlock`, table(tableName).update({ is_locked: false }).eq('id', id).select('*').single());
  },

  softDelete(tableName, id, userId) {
    return runSupabaseQuery(
      `documents.${tableName}.softDelete`,
      table(tableName).update({ deleted_at: new Date().toISOString(), deleted_by: userId }).eq('id', id).select('*').single()
    );
  },

  restore(tableName, id, userId) {
    return runSupabaseQuery(
      `documents.${tableName}.restore`,
      table(tableName).update({
        deleted_at: null,
        deleted_by: null,
        restored_at: new Date().toISOString(),
        restored_by: userId,
      }).eq('id', id).select('*').single()
    );
  },
};
