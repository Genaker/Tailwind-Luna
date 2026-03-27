/**
 * Expose store base URL for minicart template (Continue Shopping, etc.).
 */
define([], function () {
    'use strict';

    return function (target) {
        return target.extend({
            initialize: function () {
                this._super();
                this.storeBaseUrl =
                    typeof window.checkout !== 'undefined' && window.checkout.baseUrl
                        ? window.checkout.baseUrl
                        : '/';
                return this;
            }
        });
    };
});
