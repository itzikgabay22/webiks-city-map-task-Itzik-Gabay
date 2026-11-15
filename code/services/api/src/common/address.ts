export interface AddressQuery {
  /** Normalised street part, e.g. "olive street". */
  street: string;
  /** House number if the query has one ("olive street 12" -> 12). */
  houseNumber: number | null;
}

/** Splits "Olive Street 12" / "12 olive street" into street and house number. */
export function parseAddressQuery(raw: string): AddressQuery {
  const words = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const index = words.findIndex((w) => /^\d{1,5}$/.test(w));
  const houseNumber = index === -1 ? null : Number(words[index]);
  const street = (index === -1 ? words : words.filter((_, i) => i !== index)).join(' ');
  return { street, houseNumber };
}
