export type UsdExchangeRateDto = {
  base: "USD";
  quote: "TRY";
  rate: string;
  rateType: "FOREX_SELLING";
  effectiveDate: string;
  fetchedAt: string;
  isStale: boolean;
};
