/**
 * Расчёты для отчётов по продажам.
 *
 * Вынесено из компонента отдельным модулем: это чистые функции без React,
 * их можно проверять тестами и переиспользовать.
 */

/** Порядок колонок в отчётах. */
export const PAYMENT_ORDER = ['kaspi_qr', 'kaspi', 'cash'];

const emptyTotals = () => PAYMENT_ORDER.reduce((acc, method) => ({ ...acc, [method]: 0 }), {});

const num = (value) => Number(value) || 0;

/** Продажа участвует в отчёте, если она не удалена и не отменена. */
export const isReportableSale = (sale) => (
  !sale?.is_deleted && sale?.document_status !== 'cancelled'
);

export const filterSales = (sales = [], { branchId = 'all', dateFrom, dateTo } = {}) => {
  return sales.filter((sale) => {
    if (!isReportableSale(sale)) return false;
    if (branchId !== 'all' && sale.branch_id !== branchId) return false;
    if (dateFrom && sale.sale_date && sale.sale_date < dateFrom) return false;
    if (dateTo && sale.sale_date && sale.sale_date > dateTo) return false;
    return true;
  });
};

/**
 * Отчёт 1: строки — наименования товаров,
 * колонки — суммы и количество по каждому виду оплаты.
 */
export const buildPivot = (sales = []) => {
  const map = new Map();

  sales.forEach((sale) => {
    const name = sale.product_name || 'Без наименования';
    if (!map.has(name)) {
      map.set(name, { name, amounts: emptyTotals(), quantities: emptyTotals(), quantity: 0, total: 0 });
    }
    const row = map.get(name);
    const method = PAYMENT_ORDER.includes(sale.payment_method) ? sale.payment_method : null;

    if (method) {
      row.amounts[method] += num(sale.total);
      row.quantities[method] += num(sale.quantity);
    }
    row.quantity += num(sale.quantity);
    row.total += num(sale.total);
  });

  const rows = Array.from(map.values()).sort((a, b) => b.total - a.total);
  const totals = { amounts: emptyTotals(), quantities: emptyTotals(), quantity: 0, total: 0 };

  rows.forEach((row) => {
    PAYMENT_ORDER.forEach((method) => {
      totals.amounts[method] += row.amounts[method];
      totals.quantities[method] += row.quantities[method];
    });
    totals.quantity += row.quantity;
    totals.total += row.total;
  });

  return { rows, totals };
};

/** Отчёт 2: свод по каждому виду оплаты. */
export const buildMethodSummary = (sales = [], labelFor = (m) => m) => {
  return PAYMENT_ORDER.map((method) => {
    const list = sales.filter((sale) => sale.payment_method === method);
    const amount = list.reduce((sum, sale) => sum + num(sale.total), 0);
    return {
      method,
      label: labelFor(method),
      count: list.length,
      quantity: list.reduce((sum, sale) => sum + num(sale.quantity), 0),
      amount,
      average: list.length ? amount / list.length : 0,
    };
  });
};

/** Отчёт 3: аналитика. groupBy — 'day' или 'month'. */
export const buildAnalytics = (sales = [], { groupBy = 'day', labelFor = (m) => m, colors = [] } = {}) => {
  const revenue = sales.reduce((sum, sale) => sum + num(sale.total), 0);
  const quantity = sales.reduce((sum, sale) => sum + num(sale.quantity), 0);
  const count = sales.length;

  const dynamicMap = new Map();
  sales.forEach((sale) => {
    const date = sale.sale_date || '';
    const key = groupBy === 'day' ? date : date.slice(0, 7);
    if (!key) return;
    if (!dynamicMap.has(key)) dynamicMap.set(key, { key, total: 0, ...emptyTotals() });
    const bucket = dynamicMap.get(key);
    bucket.total += num(sale.total);
    if (PAYMENT_ORDER.includes(sale.payment_method)) {
      bucket[sale.payment_method] += num(sale.total);
    }
  });
  const dynamics = Array.from(dynamicMap.values()).sort((a, b) => a.key.localeCompare(b.key));

  const structure = PAYMENT_ORDER.map((method, index) => {
    const amount = sales
      .filter((sale) => sale.payment_method === method)
      .reduce((sum, sale) => sum + num(sale.total), 0);
    return {
      name: labelFor(method),
      value: amount,
      share: revenue ? (amount / revenue) * 100 : 0,
      color: colors[index % (colors.length || 1)],
    };
  }).filter((item) => item.value > 0);

  const productMap = new Map();
  sales.forEach((sale) => {
    const name = sale.product_name || 'Без наименования';
    if (!productMap.has(name)) productMap.set(name, { name, quantity: 0, total: 0 });
    const item = productMap.get(name);
    item.quantity += num(sale.quantity);
    item.total += num(sale.total);
  });
  const topProducts = Array.from(productMap.values()).sort((a, b) => b.total - a.total);

  const branchMap = new Map();
  sales.forEach((sale) => {
    const name = sale.branch_name || 'Без филиала';
    if (!branchMap.has(name)) {
      branchMap.set(name, { name, count: 0, quantity: 0, total: 0, ...emptyTotals() });
    }
    const item = branchMap.get(name);
    item.count += 1;
    item.quantity += num(sale.quantity);
    item.total += num(sale.total);
    if (PAYMENT_ORDER.includes(sale.payment_method)) {
      item[sale.payment_method] += num(sale.total);
    }
  });
  const byBranch = Array.from(branchMap.values()).sort((a, b) => b.total - a.total);

  return {
    revenue, quantity, count,
    average: count ? revenue / count : 0,
    dynamics, structure, topProducts, byBranch,
  };
};
