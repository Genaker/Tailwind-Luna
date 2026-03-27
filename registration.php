<?php
/**
 * Copyright © Genaker. All rights reserved.
 */
declare(strict_types=1);

use Magento\Framework\Component\ComponentRegistrar;

$themeDir = __DIR__;

ComponentRegistrar::register(
    ComponentRegistrar::THEME,
    'frontend/Genaker/tailwind_luna',
    $themeDir
);

ComponentRegistrar::register(
    ComponentRegistrar::THEME,
    'frontend/Genaker/win_luna',
    $themeDir
);
