<?php
/**
 * Emits a single stylesheet link: prefers {name}.min.css when readable, else {name}.css.
 * Layout passes argument css_path (e.g. css/tailwind.css, css/checkout.css).
 * Works with npm-built *.min.css and with Magento static deploy minification (dev/css/minify_files).
 */
declare(strict_types=1);

namespace Genaker\ThemeTileWindLuna\Block;

use Magento\Framework\View\Asset\Repository;
use Magento\Framework\View\Element\AbstractBlock;
use Magento\Framework\View\Element\Template\Context;

class ResolveCss extends AbstractBlock
{
    public function __construct(
        Context $context,
        private readonly Repository $assetRepo,
        array $data = [],
    ) {
        parent::__construct($context, $data);
    }

    /**
     * @return string
     */
    protected function _toHtml()
    {
        $relative = (string) $this->getData('css_path');
        if ($relative === '') {
            return '';
        }
        $chosen = $this->resolvePreferMin($relative);
        $asset = $this->assetRepo->createAsset($chosen);

        return sprintf(
            '<link rel="stylesheet" type="text/css" media="all" href="%s" />',
            $this->escapeUrl($asset->getUrl()),
        );
    }

    private function resolvePreferMin(string $path): string
    {
        foreach ($this->candidates($path) as $candidate) {
            if ($this->assetReadable($candidate)) {
                return $candidate;
            }
        }

        return $path;
    }

    /**
     * @return string[]
     */
    private function candidates(string $path): array
    {
        $min = $this->minVariantPath($path);
        if ($min !== null) {
            return [$min, $path];
        }

        return [$path];
    }

    private function minVariantPath(string $path): ?string
    {
        if (preg_match('/\.min\.css$/', $path)) {
            return null;
        }
        if (!str_ends_with($path, '.css')) {
            return null;
        }
        $min = preg_replace('/\.css$/', '.min.css', $path);
        return is_string($min) && $min !== $path ? $min : null;
    }

    private function assetReadable(string $relativePath): bool
    {
        try {
            $asset = $this->assetRepo->createAsset($relativePath);
            $file = $asset->getSourceFile();
            return $file !== '' && is_readable($file) && filesize($file) > 0;
        } catch (\Throwable $e) {
            return false;
        }
    }
}
