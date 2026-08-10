import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../modules/m1-core-identitet/auth/guards/jwt-auth.guard';

/**
 * JwtModule + JwtAuthGuard izdvojeni ovde (ne u AuthModule) da bi drugi moduli
 * (npr. AuditLogModule) mogli da koriste JwtAuthGuard bez kružne zavisnosti
 * ka AuthModule (koji sam po sebi zavisi od AuditLogModule).
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthSharedModule {}
