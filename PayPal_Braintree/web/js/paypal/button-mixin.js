/**
 * Skip Braintree client creation when client token is missing (avoids
 * BraintreeError INSTANTIATION_OPTION_REQUIRED). Mirrors express-paypal.js
 * initPayPalButtons guard.
 */
define(function () {
    'use strict';

    return function (target) {
        return target.extend({
            loadSDK: function (buttonConfig) {
                if (!buttonConfig || !buttonConfig.clientToken) {
                    return;
                }
                return this._super(buttonConfig);
            }
        });
    };
});
