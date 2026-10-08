export class ReportService {
  static charges(order) {
    return (order.order_charges ?? []).reduce((sum, c) => sum + Number(c.amount), 0);
  }

  // Items plus manual charges (installation, transportation, and so on).
  static grandTotal(order) {
    return Number(order.total) + ReportService.charges(order);
  }

  // Only Completed orders count as inflow; Pending is expected money.
  static totals(orders) {
    const t = { inflow: 0, pendingValue: 0, pending: 0, completed: 0, cancelled: 0 };
    for (const o of orders) {
      if (o.status === "Completed") { t.completed += 1; t.inflow += ReportService.grandTotal(o); }
      else if (o.status === "Cancelled") t.cancelled += 1;
      else { t.pending += 1; t.pendingValue += ReportService.grandTotal(o); }
    }
    return t;
  }

  // Orders are counted in the month they were created; inflow in the month completed.
  static monthly(orders) {
    const rows = {};
    const row = (key) => (rows[key] ??= { month: key, orders: 0, pending: 0, completed: 0, cancelled: 0, inflow: 0 });
    for (const o of orders) {
      const m = row(o.created_at.slice(0, 7));
      m.orders += 1;
      if (o.status === "Pending") m.pending += 1;
      if (o.status === "Completed") m.completed += 1;
      if (o.status === "Cancelled") m.cancelled += 1;
      if (o.status === "Completed") row((o.completed_at ?? o.created_at).slice(0, 7)).inflow += ReportService.grandTotal(o);
    }
    return Object.values(rows).sort((a, b) => a.month.localeCompare(b.month));
  }
}
