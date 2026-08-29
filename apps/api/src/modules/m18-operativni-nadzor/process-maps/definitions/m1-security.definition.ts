import { ProcessMapDefinition } from './process-map.types';

// M18 spec §9a — pilot "živa procesna mapa", odabran (29.8.2026, na zahtev vlasnika) kao prvi
// jer direktno odgovara na pitanje "da li neko pokušava da uđe spolja". Čvorovi odgovaraju
// tačno akcijama koje M1 auth.service.ts već upisuje u audit log (poglavlje 5 M1 spec).
export const M1_SECURITY_PROCESS_MAP: ProcessMapDefinition = {
  key: 'm1-security',
  label: 'M1 — bezbednosni signali',
  module: 'M1',
  nodes: [
    { id: 'login-success', label: 'Uspešna prijava', matchActions: ['auth.login_success'] },
    { id: 'login-failed', label: 'Pogrešna lozinka', matchActions: ['auth.login_failed'] },
    { id: 'mfa-failed', label: 'Pogrešan MFA kod', matchActions: ['auth.mfa_failed'] },
    { id: 'account-locked', label: 'Nalog zaključan', matchActions: ['user.locked'] },
    { id: 'password-reset', label: 'Lozinka resetovana', matchActions: ['auth.password_reset'] },
  ],
};
