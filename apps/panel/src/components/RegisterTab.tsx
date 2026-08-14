'use client';

import { useRegisterTab } from './TabsContext';

/** Server-komponenta stranica ne može da zove hook direktno — ovaj mali klijentski
 *  "adapter" registruje tab (naslov trenutne putanje) bez da cela stranica postane 'use client'. */
export default function RegisterTab({ label }: { label: string }) {
  useRegisterTab(label);
  return null;
}
