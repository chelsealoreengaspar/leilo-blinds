// Shows the live quote. The database recalculates the real price on checkout.
export class PricingService {
  static MIN_AREA_SQFT = 15;
  static CASING_PER_FT = { Plastic: 35, Metal: 85 };
  static ACETATE_FEE = 120;

  static area(item) {
    return Math.max(PricingService.MIN_AREA_SQFT, (item.width * item.height) / 144);
  }

  static unitPrice(item) {
    const fabric = PricingService.area(item) * item.fabric.price_per_sqft;
    const casing = (item.width / 12) * PricingService.CASING_PER_FT[item.casing];
    const cover = item.acetate ? PricingService.ACETATE_FEE : 0;
    return Math.round(fabric + casing + cover);
  }

  static lineTotal(item) {
    return PricingService.unitPrice(item) * item.quantity;
  }
}
