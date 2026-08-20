-- Adiciona campo CPF/CNPJ ao cadastro de clientes
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "cpfCnpj" TEXT;
