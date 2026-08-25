// mammoth (M15 spec v1.43, prilog Word dokumenta u AI chat) nema sopstvene TypeScript tipove
// niti @types/mammoth paket na npm-u — minimalna ambijentalna deklaracija, samo za oblik koji
// ovaj repozitorijum stvarno koristi (extractRawText iz buffer-a).
declare module 'mammoth' {
  export function extractRawText(input: { buffer: Buffer }): Promise<{ value: string; messages: unknown[] }>;
}
