export class ReportService {
  static monthly(orders) {
    const months = {};
    for (const o of orders) {
      const key = o.created_at.slice(0, 7);
      const m = (months[key] ??= { month: key, orders: 0, blinds: 0, revenue: 0 });
      m.orders += 1;
      m.blinds += o.order_items.reduce((s, i) => s + i.quantity, 0);
      m.revenue += Number(o.total);
    }
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }
}
