export function formatCurrency(amount?: number, currency: string = 'Rs') {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${currency}0.00`;
  }
  return `${currency}${Number(amount).toFixed(2)}`;
}