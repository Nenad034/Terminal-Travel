// M18 spec §9a — "Live procesna mapa". Definicija je opis EKRANA (koji čvor odgovara kojim
// AuditLogEntry.action vrednostima za dati module), ne poslovni podatak — zato živi u kodu,
// ne u bazi.
export interface ProcessMapNodeDefinition {
  id: string;
  label: string;
  matchActions: string[];
}

export interface ProcessMapDefinition {
  key: string;
  label: string;
  module: string;
  nodes: ProcessMapNodeDefinition[];
}
