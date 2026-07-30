export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  BRANCH_ADMIN: 'branch_admin',
  CASHIER: 'cashier',
  TRAINER: 'trainer',
  WAREHOUSE_MANAGER: 'warehouse_manager',
};

export const ROLE_LABELS = {
  [ROLES.OWNER]: 'Owner',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.BRANCH_ADMIN]: 'Branch Admin',
  [ROLES.CASHIER]: 'Cashier',
  [ROLES.TRAINER]: 'Trainer',
  [ROLES.WAREHOUSE_MANAGER]: 'Warehouse Manager',
};

export const PERMISSIONS = {
  DASHBOARD_READ: 'dashboard:read',
  STUDENTS_READ: 'students:read',
  STUDENTS_WRITE: 'students:write',
  TRAINERS_READ: 'trainers:read',
  TRAINERS_WRITE: 'trainers:write',
  PAYMENTS_READ: 'payments:read',
  PAYMENTS_WRITE: 'payments:write',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_WRITE: 'inventory:write',
  SALES_READ: 'sales:read',
  SALES_WRITE: 'sales:write',
  ATTENDANCE_READ: 'attendance:read',
  ATTENDANCE_WRITE: 'attendance:write',
  GROUPS_WRITE: 'groups:write',
  SCHEDULES_WRITE: 'schedules:write',
  REPORTS_READ: 'reports:read',
  REPORTS_EXPORT: 'reports:export',
  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',
  BRANCHES_WRITE: 'branches:write',
  USERS_MANAGE: 'users:manage',
  PERMISSIONS_MANAGE: 'permissions:manage',
  DOCUMENTS_UNLOCK: 'documents:unlock',
  DOCUMENTS_DELETE_LOCKED: 'documents:delete_locked',
  DOCUMENTS_RESTORE: 'documents:restore',
  AUDIT_LOGS_READ: 'audit_logs:read',
};

const allPermissions = Object.values(PERMISSIONS);

/**
 * Права, которые НИКОГДА не выдаются администратору, даже с полным доступом.
 * Управление учётными записями и правами остаётся только у Owner — иначе
 * администратор смог бы расширить собственные полномочия.
 */
export const OWNER_EXCLUSIVE_PERMISSIONS = [
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.PERMISSIONS_MANAGE,
];

/** Набор прав администратора с включённым «Полным доступом (как Owner)». */
export const ADMIN_FULL_ACCESS_PERMISSIONS = allPermissions.filter(
  (permission) => !OWNER_EXCLUSIVE_PERMISSIONS.includes(permission)
);

/**
 * Флаги owner-полномочий в profiles.permissions.
 * Совпадают с флагами, которые проверяет RLS в Supabase.
 */
export const OWNER_POWER_FLAGS = {
  FULL_ACCESS: 'full_access',
  CAN_EDIT: 'can_edit',
  CAN_DELETE: 'can_delete',
  CAN_ARCHIVE: 'can_archive',
  CAN_UNLOCK: 'can_unlock',
  CAN_VIEW_AUDIT: 'can_view_audit',
};

/** Дополнительные права, которые даёт каждый гранулярный флаг. */
export const FLAG_PERMISSIONS = {
  [OWNER_POWER_FLAGS.CAN_DELETE]: [
    PERMISSIONS.DOCUMENTS_RESTORE,
    PERMISSIONS.DOCUMENTS_DELETE_LOCKED,
  ],
  [OWNER_POWER_FLAGS.CAN_UNLOCK]: [PERMISSIONS.DOCUMENTS_UNLOCK],
  [OWNER_POWER_FLAGS.CAN_VIEW_AUDIT]: [PERMISSIONS.AUDIT_LOGS_READ],
};

/** Модули, доступ к которым Owner включает/выключает для администратора. */
export const PERMISSION_MODULES = [
  { key: 'students', label: 'Ученики' },
  { key: 'trainers', label: 'Тренеры' },
  { key: 'groups', label: 'Расписание и группы' },
  { key: 'attendance', label: 'Посещаемость' },
  { key: 'payments', label: 'Оплаты' },
  { key: 'inventory', label: 'Склад' },
  { key: 'sales', label: 'Продажи' },
  { key: 'reports', label: 'Отчёты' },
];

/** Owner-полномочия, выдаваемые по выбору. */
export const OWNER_POWER_OPTIONS = [
  {
    key: OWNER_POWER_FLAGS.FULL_ACCESS,
    label: 'Полный доступ (как у Owner)',
    description: 'Включает все действия ниже сразу и снимает ограничения по филиалам.',
  },
  {
    key: OWNER_POWER_FLAGS.CAN_EDIT,
    label: 'Редактирование записей',
    description: 'Изменение учеников, тренеров, расписания, посещаемости и товаров.',
  },
  {
    key: OWNER_POWER_FLAGS.CAN_DELETE,
    label: 'Удаление и корзина',
    description: 'Удаление записей в корзину и восстановление из неё.',
  },
  {
    key: OWNER_POWER_FLAGS.CAN_ARCHIVE,
    label: 'Архивация товаров',
    description: 'Перенос товаров в архив и возврат обратно.',
  },
  {
    key: OWNER_POWER_FLAGS.CAN_UNLOCK,
    label: 'Работа с проведёнными документами',
    description: 'Разблокировка, перепроведение и пересчёт оплат и продаж.',
  },
  {
    key: OWNER_POWER_FLAGS.CAN_VIEW_AUDIT,
    label: 'Журнал изменений',
    description: 'Просмотр истории всех изменений в системе.',
  },
];

export const ROLE_PERMISSIONS = {
  [ROLES.OWNER]: allPermissions,
  [ROLES.ADMIN]: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.STUDENTS_WRITE,
    PERMISSIONS.TRAINERS_READ,
    PERMISSIONS.TRAINERS_WRITE,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.PAYMENTS_WRITE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_WRITE,
    PERMISSIONS.SALES_READ,
    PERMISSIONS.SALES_WRITE,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_WRITE,
    PERMISSIONS.GROUPS_WRITE,
    PERMISSIONS.SCHEDULES_WRITE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
  ],
  [ROLES.BRANCH_ADMIN]: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.STUDENTS_WRITE,
    PERMISSIONS.TRAINERS_READ,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.PAYMENTS_WRITE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.SALES_READ,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_WRITE,
    PERMISSIONS.REPORTS_READ,
  ],
  [ROLES.CASHIER]: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.PAYMENTS_WRITE,
    PERMISSIONS.SALES_READ,
    PERMISSIONS.SALES_WRITE,
  ],
  [ROLES.TRAINER]: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.TRAINERS_READ,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_WRITE,
  ],
  [ROLES.WAREHOUSE_MANAGER]: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_WRITE,
    PERMISSIONS.SALES_READ,
    PERMISSIONS.SALES_WRITE,
  ],
};

/**
 * Соответствие «префикс права -> модуль».
 * Модульная проверка применяется только к ключам из PERMISSION_MODULES;
 * служебные права (documents, audit_logs, dashboard) модулями не ограничиваются.
 */
export const PERMISSION_RESOURCE_ALIASES = {
  schedules: 'groups',
};

export const MODULE_KEYS = PERMISSION_MODULES.map((module) => module.key);
