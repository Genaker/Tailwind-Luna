-- Magento 2: storefront customers live in customer_entity (email + password_hash on entity).
-- Run against your Magento DB (see e2e/db/README.md for connection).

-- Sample-data demo user (module-customer-sample-data / customer_profile.csv)
SELECT
    entity_id,
    email,
    website_id,
    created_at
FROM customer_entity
WHERE email = 'roni_cost@example.com';

-- Playwright fallback user (created by ensure-e2e-user.php when sample data is absent)
SELECT
    entity_id,
    email,
    website_id,
    created_at
FROM customer_entity
WHERE email = 'e2e_playwright@example.test';

-- Count customers by website (optional sanity check)
-- SELECT website_id, COUNT(*) AS n FROM customer_entity GROUP BY website_id;
