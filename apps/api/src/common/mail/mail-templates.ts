// Sistemske poruke (M1 §5) — namerno jednostavan HTML: tabele/slike/spoljni CSS ne prolaze
// kroz sve klijente jednako, a ove poruke nose tačno jednu stvar — dugme sa linkom. Uz svaki
// HTML ide i čist tekst (obavezan u `OutgoingMail`), jer deo klijenata i filtera gleda njega.

const WRAPPER_START =
  '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">';
const WRAPPER_END = '</div>';

function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${href}" style="background:#0f766e;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">${label}</a></p>`;
}

function fallbackLine(href: string): string {
  // Dugme ne radi u svakom klijentu (neki gase stilove, neki tekstualni ne prikazuju <a>) —
  // pun link u tekstu je jedini oblik koji uvek stigne do korisnika.
  return `<p style="color:#555;font-size:13px">Ako dugme ne radi, otvorite ovu adresu:<br><span style="word-break:break-all">${href}</span></p>`;
}

export function inviteEmail(params: { fullName: string; link: string; hoursValid: number }) {
  const { fullName, link, hoursValid } = params;
  return {
    subject: 'Vaš nalog na Terminal platformi — postavite lozinku',
    text: [
      `Zdravo ${fullName},`,
      '',
      'Otvoren vam je nalog na Terminal platformi. Da biste ga aktivirali, postavite svoju lozinku na ovoj adresi:',
      link,
      '',
      `Link važi ${hoursValid} sati i koristi se jednom.`,
      '',
      'Pri prvoj prijavi ćete podesiti dvofaktorsku zaštitu — obavezna je za sve interne naloge.',
      '',
      'Ako niste očekivali ovu poruku, slobodno je zanemarite — nalog bez postavljene lozinke se ne može koristiti.',
    ].join('\n'),
    html:
      WRAPPER_START +
      `<p>Zdravo ${fullName},</p>` +
      '<p>Otvoren vam je nalog na <b>Terminal</b> platformi. Da biste ga aktivirali, postavite svoju lozinku:</p>' +
      button(link, 'Postavi lozinku') +
      `<p style="color:#555;font-size:13px">Link važi ${hoursValid} sati i koristi se jednom. Pri prvoj prijavi ćete podesiti dvofaktorsku zaštitu — obavezna je za sve interne naloge.</p>` +
      fallbackLine(link) +
      '<p style="color:#555;font-size:13px">Ako niste očekivali ovu poruku, slobodno je zanemarite — nalog bez postavljene lozinke se ne može koristiti.</p>' +
      WRAPPER_END,
  };
}

export function passwordResetEmail(params: { fullName: string; link: string; hoursValid: number }) {
  const { fullName, link, hoursValid } = params;
  return {
    subject: 'Promena lozinke — Terminal',
    text: [
      `Zdravo ${fullName},`,
      '',
      'Zatražena je promena lozinke za vaš nalog. Novu lozinku postavljate na ovoj adresi:',
      link,
      '',
      `Link važi ${hoursValid} sat(a) i koristi se jednom.`,
      '',
      'Ako promenu niste tražili vi, zanemarite ovu poruku — vaša lozinka ostaje nepromenjena. ' +
        'Ako se to ponavlja, javite se nekome iz tima ko upravlja nalozima.',
    ].join('\n'),
    html:
      WRAPPER_START +
      `<p>Zdravo ${fullName},</p>` +
      '<p>Zatražena je promena lozinke za vaš nalog.</p>' +
      button(link, 'Postavi novu lozinku') +
      `<p style="color:#555;font-size:13px">Link važi ${hoursValid} sat(a) i koristi se jednom.</p>` +
      fallbackLine(link) +
      '<p style="color:#555;font-size:13px">Ako promenu niste tražili vi, zanemarite ovu poruku — vaša lozinka ostaje nepromenjena.</p>' +
      WRAPPER_END,
  };
}
