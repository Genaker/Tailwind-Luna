/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 *
 * Win Luna: do not initialize mage/sticky on .cart-summary — it sets inline top and fights
 * flex layout + checkout.css. Cart summary scrolls with the page.
 */
define([
    'jquery',
    'mage/smart-keyboard-handler',
    'mage/mage',
    'domReady!'
], function ($, keyboardHandler) {
    'use strict';

    // Core Account tab is empty; Blank/Luma clones header links here. <details> stays closed and
    // absolute dropdown clips — CSS cannot set [open]; one line fixes visibility for nav CSS below.
    $('.panel.header > .header.links').clone().appendTo('#store\\.links');
    $('#store\\.links .authorization-link details').attr('open', true);
    $('#store\\.links li a').each(function () {
        var id = $(this).attr('id');

        if (id !== undefined) {
            $(this).attr('id', id + '_mobile');
        }
    });
    keyboardHandler.apply();
});
