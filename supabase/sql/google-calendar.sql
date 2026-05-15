ALTER TABLE "LawyerSettings"
  ADD COLUMN IF NOT EXISTS "googleCalendarRefreshToken" TEXT,
  ADD COLUMN IF NOT EXISTS "googleCalendarConnected"    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "googleOAuthState"           TEXT;
