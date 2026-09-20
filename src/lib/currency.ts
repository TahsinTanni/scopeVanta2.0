// Deal currencies ScopeVanta supports, with the locale used to format each.
export const CURRENCIES = [
  { code: "USD", label: "US Dollar (USD)", locale: "en-US" },
  { code: "CAD", label: "Canadian Dollar (CAD)", locale: "en-CA" },
  { code: "EUR", label: "Euro (EUR)", locale: "de-DE" },
  { code: "GBP", label: "British Pound (GBP)", locale: "en-GB" },
  { code: "AUD", label: "Australian Dollar (AUD)", locale: "en-AU" },
  { code: "NZD", label: "New Zealand Dollar (NZD)", locale: "en-NZ" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export function isSupportedCurrency(code: unknown): code is CurrencyCode {
  return CURRENCIES.some((c) => c.code === code);
}

// Formats a money amount with the symbol/grouping of the given currency.
// Unknown currency codes fall back to USD; never throws.
export function formatCurrency(amount: number, currency: string): string {
  const entry = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat(entry.locale, { style: "currency", currency: entry.code }).format(value);
}

// Just the currency symbol (e.g. "$", "€", "£") for labels and placeholders, derived via Intl.
export function currencySymbol(currency: string): string {
  const entry = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];
  const part = new Intl.NumberFormat(entry.locale, { style: "currency", currency: entry.code })
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part?.value ?? "$";
}
