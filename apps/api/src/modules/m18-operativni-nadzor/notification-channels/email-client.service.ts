import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '../../../common/mail/mailer.service';

// M18 spec §3 — EMAIL kanal. Do 4.9.2026 namerno mock (nije bilo SMTP biblioteke u steku).
// Sada delegira zajedničkom `MailerService` (`common/mail`), isti kojim M1 šalje pozivnicu i
// reset lozinke — jedno podešavanje za celu aplikaciju umesto konekcije po modulu. Ponašanje
// bez podešenog `SMTP_HOST` je nepromenjeno: loguje se šta bi bilo poslato, isporuka tiho
// izostane, ništa ne puca (uzbuna o kvaru ne sme da postane drugi kvar).
@Injectable()
export class EmailClientService {
  private readonly logger = new Logger(EmailClientService.name);

  constructor(private readonly mailer: MailerService) {}

  isConfigured(): boolean {
    return this.mailer.isConfigured();
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    await this.mailer.send({ to, subject, text: body });
  }
}
