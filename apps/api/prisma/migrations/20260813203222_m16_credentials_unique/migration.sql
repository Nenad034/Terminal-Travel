-- AlterTable
ALTER TABLE "mcp_client_registrations" ADD CONSTRAINT "mcp_client_registrations_credentials_encrypted_key" UNIQUE ("credentials_encrypted");
