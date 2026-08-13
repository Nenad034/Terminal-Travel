import { randomBytes } from 'crypto';

// M12 spec §2.1 — "kratak, npr. 8 karaktera, bez specijalnih znakova" — koristi se kao
// ?ref=<tracking_code> na M8 (§3a), pa mora biti URL-bezbedan bez ručnog enkodovanja.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bez O/0/I/1 (lako se mešaju)

export function generateTrackingCode(): string {
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}
