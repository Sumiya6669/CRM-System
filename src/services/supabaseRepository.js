import { getSupabaseClient, runSupabaseQuery } from '@/lib/supabase';

const DEFAULT_LIMIT = 200;

export const ENTITY_TABLES = {
  Organization: 'organizations',
  Branch: 'branches',
  Profile: 'profiles',
  User: 'profiles',
  AppUser: 'users',
  AdminSlot: 'admin_slots',
  Student: 'students',
  Parent: 'parents',
  Group: 'groups',
  Coach: 'trainers',
  Trainer: 'trainers',
  Subscription: 'subscriptions',
  Payment: 'payments',
  Product: 'inventory',
  Inventory: 'inventory',
  StockItem: 'inventory_stock',
  StockTransfer: 'inventory_movements',
  InventoryMovement: 'inventory_movements',
  InventoryReceipt: 'inventory_receipts',
  StockAdjustment: 'stock_adjustments',
  Sale: 'sales',
  Attendance: 'attendance',
  ActivityLog: 'audit_logs',
  AuditLog: 'audit_logs',
  Notification: 'notifications',
  StudentTransfer: 'student_transfers',
  Invite: 'invites',
};

const normalizeSort = (sort) => {
  if (!sort || typeof sort !== 'string') {
    return null;
  }

  const descending = sort.startsWith('-');
  return {
    column: descending ? sort.slice(1) : sort,
    ascending: !descending,
  };
};

const nowIso = () => new Date().toISOString();

const withWriteDates = (payload, isCreate = false) => ({
  ...payload,
  ...(isCreate && !payload.created_date ? { created_date: nowIso() } : {}),
  updated_date: nowIso(),
});

const applyFilters = (query, filters = {}) => {
  return Object.entries(filters).reduce((nextQuery, [key, value]) => {
    if (value === undefined || value === null || value === '') {
      return nextQuery;
    }

    if (Array.isArray(value)) {
      return nextQuery.in(key, value);
    }

    return nextQuery.eq(key, value);
  }, query);
};

export const createRepository = (entityName, tableName) => {
  const getClient = () => getSupabaseClient();
  const label = `${entityName} repository`;

  return {
    tableName,

    async list(sort, limit = DEFAULT_LIMIT) {
      const sortSpec = normalizeSort(sort);
      let query = getClient().from(tableName).select('*');

      if (sortSpec) {
        query = query.order(sortSpec.column, { ascending: sortSpec.ascending });
      }

      if (limit) {
        query = query.limit(limit);
      }

      return runSupabaseQuery(`${label}.list`, query);
    },

    async filter(filters = {}, sort, limit = DEFAULT_LIMIT) {
      const sortSpec = normalizeSort(sort);
      let query = applyFilters(getClient().from(tableName).select('*'), filters);

      if (sortSpec) {
        query = query.order(sortSpec.column, { ascending: sortSpec.ascending });
      }

      if (limit) {
        query = query.limit(limit);
      }

      return runSupabaseQuery(`${label}.filter`, query);
    },

    async getById(id) {
      return runSupabaseQuery(
        `${label}.getById`,
        getClient().from(tableName).select('*').eq('id', id).maybeSingle()
      );
    },

    async create(payload) {
      return runSupabaseQuery(
        `${label}.create`,
        getClient().from(tableName).insert(withWriteDates(payload, true)).select('*').single()
      );
    },

    async bulkCreate(records) {
      const payload = records.map((record) => withWriteDates(record, true));
      return runSupabaseQuery(`${label}.bulkCreate`, getClient().from(tableName).insert(payload).select('*'));
    },

    async bulkUpsert(records, onConflict) {
      const payload = records.map((record) => withWriteDates(record, true));
      return runSupabaseQuery(
        `${label}.bulkUpsert`,
        getClient().from(tableName).upsert(payload, { onConflict }).select('*')
      );
    },

    async update(id, payload) {
      return runSupabaseQuery(
        `${label}.update`,
        getClient().from(tableName).update(withWriteDates(payload)).eq('id', id).select('*').single()
      );
    },

    async delete(id) {
      return runSupabaseQuery(`${label}.delete`, getClient().from(tableName).delete().eq('id', id).select('*').single());
    },
  };
};

export const createEntityRepositories = () => {
  return Object.entries(ENTITY_TABLES).reduce((repositories, [entityName, tableName]) => {
    repositories[entityName] = createRepository(entityName, tableName);
    return repositories;
  }, {});
};
