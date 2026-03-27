<?php
/**
 * Resolve E2E storefront user for Playwright (prints one JSON line to stdout).
 *
 * Order:
 * 1. E2E_USER_EMAIL + E2E_USER_PASSWORD env — use as-is (source: env).
 * 2. Magento sample-data customer roni_cost@example.com exists — use known demo password (source: sample_data).
 * 3. Else create or reuse E2E_FALLBACK_EMAIL (default e2e_playwright@example.test) (source: created|fallback_exists).
 *
 * Stderr: human-readable log. Stdout: single JSON object only.
 */
declare(strict_types=1);

/** From vendor/magento/module-customer-sample-data/fixtures/customer_profile.csv */
$sampleDataEmail = 'roni_cost@example.com';
$sampleDataPassword = 'roni_cost3@example.com';

$fallbackEmail = getenv('E2E_FALLBACK_EMAIL') ?: 'e2e_playwright@example.test';
$fallbackPassword = getenv('E2E_FALLBACK_PASSWORD') ?: 'TestPass123!';

$envEmail = getenv('E2E_USER_EMAIL') ?: '';
$envPassword = getenv('E2E_USER_PASSWORD') ?: '';

if ($envEmail !== '' && $envPassword !== '') {
    $out = [
        'email' => $envEmail,
        'password' => $envPassword,
        'source' => 'env',
    ];
    fwrite(STDERR, '[ensure-e2e-user] Using E2E_USER_EMAIL / E2E_USER_PASSWORD from environment.' . "\n");
    fwrite(STDOUT, json_encode($out, JSON_UNESCAPED_SLASHES));
    exit(0);
}

$magentoRoot = getenv('MAGENTO_ROOT') ?: dirname(__DIR__, 4);
$bootstrap = $magentoRoot . '/app/bootstrap.php';
if (!is_file($bootstrap)) {
    fwrite(STDERR, "[ensure-e2e-user] Magento not found at MAGENTO_ROOT={$magentoRoot}\n");
    exit(1);
}

require $bootstrap;

/** @var \Magento\Framework\App\Bootstrap $app */
$app = \Magento\Framework\App\Bootstrap::create(BP, $_SERVER);
$om = $app->getObjectManager();

$state = $om->get(\Magento\Framework\App\State::class);
$state->setAreaCode(\Magento\Framework\App\Area::AREA_FRONTEND);

$storeManager = $om->get(\Magento\Store\Model\StoreManagerInterface::class);
$websiteId = (int) $storeManager->getWebsite()->getId();
$storeId = (int) $storeManager->getStore()->getId();

$customerRepository = $om->get(\Magento\Customer\Api\CustomerRepositoryInterface::class);
$customerFactory = $om->get(\Magento\Customer\Api\Data\CustomerInterfaceFactory::class);
$accountManagement = $om->get(\Magento\Customer\Api\AccountManagementInterface::class);

try {
    $customerRepository->get($sampleDataEmail, $websiteId);
    $out = [
        'email' => $sampleDataEmail,
        'password' => $sampleDataPassword,
        'source' => 'sample_data',
    ];
    fwrite(STDERR, '[ensure-e2e-user] Sample-data customer exists: ' . $sampleDataEmail . " (Magento demo data)\n");
    fwrite(STDOUT, json_encode($out, JSON_UNESCAPED_SLASHES));
    exit(0);
} catch (\Magento\Framework\Exception\NoSuchEntityException $e) {
    // continue to fallback
}

try {
    $customerRepository->get($fallbackEmail, $websiteId);
    $out = [
        'email' => $fallbackEmail,
        'password' => $fallbackPassword,
        'source' => 'fallback_exists',
    ];
    fwrite(STDERR, '[ensure-e2e-user] Fallback user already exists: ' . $fallbackEmail . "\n");
    fwrite(STDOUT, json_encode($out, JSON_UNESCAPED_SLASHES));
    exit(0);
} catch (\Magento\Framework\Exception\NoSuchEntityException $e) {
    // create
}

$customer = $customerFactory->create();
$customer->setEmail($fallbackEmail);
$customer->setFirstname('E2E');
$customer->setLastname('Playwright');
$customer->setWebsiteId($websiteId);
$customer->setStoreId($storeId);

try {
    $accountManagement->createAccount($customer, $fallbackPassword);
    $out = [
        'email' => $fallbackEmail,
        'password' => $fallbackPassword,
        'source' => 'created',
    ];
    fwrite(STDERR, '[ensure-e2e-user] Created fallback user: ' . $fallbackEmail . "\n");
    fwrite(STDOUT, json_encode($out, JSON_UNESCAPED_SLASHES));
    exit(0);
} catch (\Magento\Framework\Exception\LocalizedException $e) {
    fwrite(STDERR, '[ensure-e2e-user] ERROR: ' . $e->getMessage() . "\n");
    exit(1);
}
