-- Rename PlanOrg enum: FREE→STARTER, PREMIUM→STANDARD, PLATINUM→PROFESSIONAL, add ENTERPRISE
-- Uses type recreation since PostgreSQL does not support ALTER TYPE ... RENAME VALUE atomically

-- Step 1: Create new enum type
CREATE TYPE "PlanOrg_new" AS ENUM ('STARTER', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE');

-- Step 2: Migrate column, casting old values to new
ALTER TABLE "Organization"
  ALTER COLUMN "plan" TYPE "PlanOrg_new"
  USING (
    CASE "plan"::text
      WHEN 'FREE'         THEN 'STARTER'::"PlanOrg_new"
      WHEN 'PREMIUM'      THEN 'STANDARD'::"PlanOrg_new"
      WHEN 'PLATINUM'     THEN 'PROFESSIONAL'::"PlanOrg_new"
      WHEN 'PROFESSIONAL' THEN 'PROFESSIONAL'::"PlanOrg_new"
      ELSE                     'STARTER'::"PlanOrg_new"
    END
  );

-- Step 3: Update default
ALTER TABLE "Organization" ALTER COLUMN "plan" SET DEFAULT 'STARTER'::"PlanOrg_new";

-- Step 4: Drop old type and rename new type
DROP TYPE "PlanOrg";
ALTER TYPE "PlanOrg_new" RENAME TO "PlanOrg";
