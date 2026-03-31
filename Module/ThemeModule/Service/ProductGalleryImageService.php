<?php
declare(strict_types=1);

namespace Genaker\ThemeTailwindLuna\Service;

use Magento\Catalog\Block\Product\View\Gallery;
use Magento\Catalog\Helper\Image as ImageHelper;
use Magento\Catalog\Model\Product;
use Magento\Framework\View\Element\Block\ArgumentInterface;

/**
 * Builds gallery item URLs, dimensions, and JSON config for PDP gallery.phtml.
 */
class ProductGalleryImageService implements ArgumentInterface
{
    /**
     * @return array{
     *     items: list<array{thumb: string, medium: string, full: string, small: string, mobile: string, label: string}>,
     *     mainIndex: int,
     *     mediumWidth: int,
     *     mediumHeight: int,
     *     mobileWidth: int,
     *     fullWidth: int,
     *     canonicalUrl: string,
     *     galleryConfig: string
     * }
     */
    public function build(Gallery $block): array
    {
        $product = $block->getProduct();
        $rawImages = $block->getGalleryImages()->getItems();
        /** @var ImageHelper $imgHelper */
        $imgHelper = $block->getData('imageHelper');
        $placeholder = $imgHelper->getDefaultPlaceholderUrl('image');

        $galleryItems = [];
        $mainIndex = 0;
        $position = 0;

        foreach ($rawImages as $img) {
            if ($block->isMainImage($img)) {
                $mainIndex = $position;
            }
            $mediumUrl = (string) $img->getData('medium_image_url');
            $largeUrl = (string) $img->getData('large_image_url');
            $smallUrl = (string) $img->getData('small_image_url');

            $galleryItems[] = [
                'thumb' => $this->firstNonEmpty($smallUrl, $mediumUrl, $largeUrl),
                'medium' => $this->firstNonEmpty($mediumUrl, $largeUrl),
                'full' => $largeUrl,
                'small' => $smallUrl,
                'mobile' => $this->buildMobileUrl($img, $imgHelper, $product),
                'label' => (string) ($img->getData('label') ?: $product->getName()),
            ];
            $position++;
        }

        if ($galleryItems === []) {
            $galleryItems = [[
                'thumb' => $placeholder,
                'medium' => $placeholder,
                'full' => $placeholder,
                'small' => $placeholder,
                'mobile' => '',
                'label' => (string) $product->getName(),
            ]];
            $mainIndex = 0;
        }

        $mediumWidth = (int) ($block->getImageAttribute('product_page_image_medium', 'width') ?: 540);
        $mediumHeight = (int) ($block->getImageAttribute('product_page_image_medium', 'height') ?: 540);
        $mobileWidth = (int) ($block->getImageAttribute('product_page_image_medium_mobile', 'width') ?: 400);
        $fullWidth = (int) ($block->getImageAttribute('product_page_image_large', 'width') ?: 540);

        $activeItem = $galleryItems[$mainIndex];
        $canonicalUrl = $this->firstNonEmpty($activeItem['medium'], $activeItem['full'], $placeholder);

        $galleryConfig = json_encode(
            [
                'items' => $galleryItems,
                'mainIndex' => $mainIndex,
                'widths' => [
                    'mobile' => $mobileWidth,
                    'medium' => $mediumWidth,
                    'full' => $fullWidth,
                ],
            ],
            JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR
        );

        return [
            'items' => $galleryItems,
            'mainIndex' => $mainIndex,
            'mediumWidth' => $mediumWidth,
            'mediumHeight' => $mediumHeight,
            'mobileWidth' => $mobileWidth,
            'fullWidth' => $fullWidth,
            'canonicalUrl' => $canonicalUrl,
            'galleryConfig' => $galleryConfig,
        ];
    }

    private function firstNonEmpty(string ...$candidates): string
    {
        foreach ($candidates as $url) {
            if ($url !== '') {
                return $url;
            }
        }
        return '';
    }

    /**
     * Build the ≤600px mobile URL for a gallery image.
     *   1. Use medium_mobile_url (400px via di.xml) when Magento has generated it.
     *   2. Fall back to a 365×260 resize of product_page_image_small (reactmagento2 pattern).
     *   3. Return '' on any error so the caller falls back to medium.
     *
     * @param \Magento\Framework\DataObject $img
     */
    private function buildMobileUrl($img, ImageHelper $imgHelper, Product $product): string
    {
        $fromConfig = (string) $img->getData('medium_mobile_url');
        if ($fromConfig !== '') {
            return $fromConfig;
        }
        $file = (string) $img->getData('file');
        if ($file === '') {
            return '';
        }
        try {
            return (string) $imgHelper
                ->init($product, 'product_page_image_small', ['type' => 'image'])
                ->setImageFile($file)
                ->resize(400, 260)
                ->keepAspectRatio(true)
                ->setQuality(80)
                ->getUrl();
        } catch (\Throwable) {
            return '';
        }
    }
}
