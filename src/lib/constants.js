export const BELT_LABELS = {
  white: 'Белый',
  yellow: 'Жёлтый',
  green: 'Зелёный',
  blue: 'Синий',
  red: 'Красный',
  black_1dan: 'Чёрный 1 дан',
  black_2dan: 'Чёрный 2 дан',
  black_3dan: 'Чёрный 3 дан',
  black_4dan: 'Чёрный 4 дан',
};

export const BELT_COLORS = {
  white: '#f5f5f5',
  yellow: '#fbbf24',
  green: '#22c55e',
  blue: '#3b82f6',
  red: '#ef4444',
  black_1dan: '#1a1a1a',
  black_2dan: '#1a1a1a',
  black_3dan: '#1a1a1a',
  black_4dan: '#1a1a1a',
};

export const STATUS_LABELS = {
  active: 'Активен',
  frozen: 'Заморожен',
  archived: 'Архив',
  inactive: 'Неактивен',
};

export const PAYMENT_STATUS_LABELS = {
  paid: 'Оплачено',
  partial: 'Частично',
  debt: 'Долг',
  overdue: 'Просрочено',
  cancelled: 'Отменено',
};

export const PAYMENT_STATUS_COLORS = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  debt: 'bg-red-50 text-red-700 border-red-200',
  overdue: 'bg-red-50 text-red-800 border-red-300',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
};

export const PAYMENT_METHOD_LABELS = {
  kaspi: 'Kaspi',
  cash: 'Наличные',
  kaspi_qr: 'Kaspi QR',
};

export const PRODUCT_CATEGORY_LABELS = {
  dobok: 'Добок / Форма',
  belts: 'Пояса',
  helmets: 'Шлемы',
  protection: 'Защита',
  gloves: 'Перчатки',
  pads: 'Накладки',
  merch: 'Мерч',
  other: 'Прочее',
};

export const ACTION_TYPE_LABELS = {
  student_added: 'Ученик добавлен',
  student_edited: 'Ученик изменён',
  student_transferred: 'Ученик переведён',
  student_archived: 'Ученик архивирован',
  payment_received: 'Оплата принята',
  payment_cancelled: 'Оплата отменена',
  sale_completed: 'Продажа товара',
  stock_received: 'Приход товара',
  stock_written_off: 'Списание товара',
  stock_transferred: 'Перемещение товара',
  branch_added: 'Филиал добавлен',
  subscription_changed: 'Абонемент изменён',
  attendance_marked: 'Посещение отмечено',
  group_added: 'Группа добавлена',
  coach_added: 'Тренер добавлен',
};

export const DAYS_OF_WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const formatMoney = (amount) => {
  if (amount == null) return '0 ₸';
  return new Intl.NumberFormat('ru-KZ').format(amount) + ' ₸';
};

export const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const getAge = (birthDate) => {
  if (!birthDate) return '—';
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};