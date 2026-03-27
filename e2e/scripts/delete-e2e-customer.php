<?php
/**
 * Delete storefront customer by email (for Playwright teardown).
 *
 * Usage:
 *   php packages/theme-frontend-win-luna/e2e/scripts/delete-e2e-customer.php
 *
 * Env: MAGENTO_ROOT, E2E_USER_EMAIL (required)
 */
declare(strict_types=1);

$magentoRoot = getenv('MAGENTO_ROOT') ?: dirname(__DIR__, 4);
$bootstrap = $magentoRoot . '/app/bootstrap.php';
if (!is_file($bootstrap)) {
    fwrite(STDERR, "[e2e-delete-customer] Magento not found at MAGENTO_ROOT={$magentoRoot}\n");
    exit(1);
}

require $bootstrap;

$app = \Magento\Framework\App\Bootstrap::create(BP, $_SERVER);
$om = $app->getObjectManager();

$state = $om->get(\Magento\Framework\App\State::class);
$state->setAreaCode(\Magento\Framework\App\Area::AREA_GLOBAL);

$email = getenv('E2E_USER_EMAIL') ?: '';
if ($email === '') {
    fwrite(STDERR, "[e2e-delete-customer] Set E2E_USER_EMAIL\n");
    exit(1);
}

$storeManager = $om->get(\Magento\Store\Model\StoreManagerInterface::class);
$websiteId = (int) $storeManager->getWebsite()->getId();
$customerRepository = $om->get(\Magento\Customer\Api\CustomerRepositoryInterface::class);
$registry = $om->get(\Magento\Framework\Registry::class);
$registry->register('isSecureArea', true);

try {
    $customer = $customerRepository->get($email, $websiteId);
    $customerRepository->delete($customer);
    fwrite(STDOUT, "[e2e-delete-customer] DELETED: {$email}\n");
    exit(0);
} catch (\Magento\Framework\Exception\NoSuchEntityException $e) {
    fwrite(STDOUT, "[e2e-delete-customer] NOT FOUND (skip): {$email}\n");
    exit(0);
} catch (\Exception $e) {
    fwrite(STDERR, '[e2e-delete-customer] ERROR: ' . $e->getMessage() . "\n");
    exit(1);
}
