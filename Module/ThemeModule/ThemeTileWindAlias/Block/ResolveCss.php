<?php
/**
 * Back-compat: some installs had a composer.lock typo (ThemeTileWind vs ThemeTailwind), so layout
 * or caches could reference Genaker\ThemeTileWindLuna\Block\ResolveCss. The real class is
 * Genaker\ThemeTailwindLuna\Block\ResolveCss — this subclass delegates to it.
 *
 * @deprecated Prefer ThemeTailwindLuna in layout XML; run composer dump-autoload after fixing lock.
 */
declare(strict_types=1);

namespace Genaker\ThemeTileWindLuna\Block;

class ResolveCss extends \Genaker\ThemeTailwindLuna\Block\ResolveCss
{
}
