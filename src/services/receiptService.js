import { getSupabaseClient } from '@/lib/supabase';

const unwrap = ({ data, error }, label) => {
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  return data;
};

export const receiptService = {
  /** Следующий номер документа поступления внутри организации. */
  nextNumber: async () => {
    const client = getSupabaseClient();
    return unwrap(await client.rpc('next_receipt_number'), 'receipt.nextNumber');
  },

  /**
   * Проведение документа. Одной транзакцией на стороне базы:
   * увеличивает остатки, обновляет цены товаров, пишет движения
   * и блокирует документ от повторного проведения.
   */
  post: async (receiptId) => {
    const client = getSupabaseClient();
    return unwrap(
      await client.rpc('post_inventory_receipt', { p_receipt_id: receiptId }),
      'receipt.post'
    );
  },
};
