<?php
declare(strict_types=1);

namespace Genaker\ThemeTailwindLuna\Observer;

use Magento\Framework\App\Area;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\App\Response\Http as HttpResponse;
use Magento\Framework\App\State;
use Magento\Framework\Event\Observer;
use Magento\Framework\Event\ObserverInterface;
use Magento\Store\Model\ScopeInterface;

/**
 * Moves ALL script tags to just before </body>, preserving their original relative order.
 *
 * Moving every script — including the RequireJS bootstrap chain and inline require.config()
 * calls — to the bottom is safe because their relative order is preserved. The browser
 * renders the complete HTML (FCP/LCP fires) and only then begins executing JS.
 *
 * Scripts that stay in place:
 *   - type="text/x-magento-template"  (KO template containers; must be near binding context)
 *   - no-defer attribute               (explicit opt-out)
 *
 * @see https://github.com/Genaker/magento-js-perf
 */
class DeferJsObserver implements ObserverInterface
{
    public const XML_PATH_DEFER_JS           = 'genaker_theme_tailwind_luna/js/defer_js';
    public const XML_PATH_DEFER_NON_CRITICAL = 'genaker_theme_tailwind_luna/js/defer_non_critical';

    public function __construct(
        private readonly State $state,
        private readonly ScopeConfigInterface $scopeConfig
    ) {
    }

    public function execute(Observer $observer): void
    {
        try {
            if ($this->state->getAreaCode() !== Area::AREA_FRONTEND) {
                return;
            }
        } catch (\Throwable) {
            return;
        }

        /** @var HttpResponse|null $response */
        $response = $observer->getEvent()->getData('response');
        if (!$response instanceof HttpResponse) {
            return;
        }

        // Skip non-HTML responses (AJAX, JSON, XML).
        $contentType = $response->getHeader('Content-Type');
        if ($contentType && !str_contains((string) $contentType->getFieldValue(), 'text/html')) {
            return;
        }

        $html = $response->getBody();
        if ($html === '') {
            return;
        }

        /** @var RequestInterface|null $request */
        $request = $observer->getEvent()->getData('request');
        if (!$this->shouldDeferJs($request)) {
            return;
        }

        if ($this->shouldSkipDeferForReactVueConfig()) {
            return;
        }

        if (stripos($html, '<script') === false) {
            return;
        }

        // Match ALL <script> tags regardless of type attribute.
        // U flag makes .* ungreedy — each match stops at the first </script>.
        $pattern = '@<script(?![^>]*\bno-defer\b)([^>]*>)(.*)</script>@msU';

        $toAppend = [];
        $html = (string) preg_replace_callback(
            $pattern,
            function (array $m) use (&$toAppend): string {
                $tag = $m[0];

                // Keep Knockout template containers in place; KO resolves them by ID
                // and they must be in the DOM before the binding context renders.
                if (preg_match('/\btype\s*=\s*["\']text\/x-magento-template["\']/i', $tag)) {
                    return $tag;
                }

                $toAppend[] = $tag;

                return '';
            },
            $html
        );

        if ($toAppend === []) {
            return;
        }

        // Insert before the last </body> so scripts are inside a valid document body.
        $bodyClose = strrpos($html, '</body>');
        if ($bodyClose !== false) {
            $block = "\n" . implode("\n", $toAppend) . "\n";
            $html  = substr($html, 0, $bodyClose) . $block . substr($html, $bodyClose);
        } else {
            // Fallback: no </body> found — append to end.
            $html .= implode('', $toAppend);
        }

        $response->setBody($html);
    }

    /**
     * Upstream: when react_vue_config/junk/remove is set, skip script reordering.
     * Compatibility with Genaker ReactMagento2.
     */
    private function shouldSkipDeferForReactVueConfig(): bool
    {
        $v = $this->scopeConfig->getValue('react_vue_config/junk/remove', ScopeInterface::SCOPE_STORE);

        return $v !== null && $v !== '' && (bool) $v;
    }

    /**
     * GET ?defer-js=true|false overrides store config.
     * Unset config defaults to enabled.
     */
    private function shouldDeferJs(?RequestInterface $request): bool
    {
        if ($request !== null) {
            $param = $request->getParam('defer-js');
            if ($param === 'false') {
                return false;
            }
            if ($param === 'true') {
                return true;
            }
        }

        $configValue = $this->scopeConfig->getValue(
            self::XML_PATH_DEFER_JS,
            ScopeInterface::SCOPE_STORE
        );

        return $configValue === null || $configValue === '' ? true : (bool) $configValue;
    }
}
