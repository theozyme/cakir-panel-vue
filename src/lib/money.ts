import type { Currency } from "@/types/business";

export const formatMoneyString = (value: string, currency: Currency): string => {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());

  if (!match) return `${value} ${currency}`;

  const [, sign, whole = "0", fraction = ""] = match;
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const symbol = currency === "TRY" ? "₺" : "$";

  return `${sign}${symbol}${groupedWhole},${fraction.padEnd(2, "0")}`;
};
