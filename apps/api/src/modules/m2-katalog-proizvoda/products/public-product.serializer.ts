/**
 * M2 spec §5.1 — "Identitet dobavljača se nikad ne izlaže B2C/B2B kanalima". Ova
 * funkcija je jedina dozvoljena putanja ka odgovoru koji vidi M7/M8/M9-gost: uklanja
 * `source_type`/`source_contract_id`/`source_provider`/`source_external_id` iz payload-a
 * (ne samo iz prikaza) — sprovodi se ovde, na nivou serializera, ne na nivou fronta.
 * Interni kanal (M17) NE prolazi kroz ovaj serializer — koristi pun `Product` iz servisa.
 */
export function toPublicProduct<
  T extends {
    sourceType: unknown;
    sourceContractId: unknown;
    sourceProvider: unknown;
    sourceExternalId: unknown;
  },
>(product: T): Omit<T, 'sourceType' | 'sourceContractId' | 'sourceProvider' | 'sourceExternalId'> {
  const { sourceType, sourceContractId, sourceProvider, sourceExternalId, ...publicFields } = product;
  void sourceType;
  void sourceContractId;
  void sourceProvider;
  void sourceExternalId;
  return publicFields;
}
