UPDATE settings
SET monthly_budget_cents = 100000
WHERE monthly_budget_cents <= 0;
