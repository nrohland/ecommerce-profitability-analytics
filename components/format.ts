// Explicit zero handling keeps server/browser ICU compact patterns consistent.
export const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
  trailingZeroDisplay: "stripIfInteger",
});
