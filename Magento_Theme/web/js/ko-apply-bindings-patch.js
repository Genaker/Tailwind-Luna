/**
 * Defers ko.applyBindings for subtree roots (non-document) by one macrotask (setTimeout 0).
 *
 * Implemented as a RequireJS dep on `ko` — avoids forking lib/web/knockoutjs/knockout.js.
 *
 * Risks (Magento often assumes synchronous subtree binding):
 *   — Next tick may race with code that reads bound DOM; checkout/minicart can break.
 *   — If anything misbehaves, disable before RequireJS loads:
 *       window.gphpDeferKoApplyBindings = false;
 *     (e.g. inline in <head> before bundled JS)
 */
define(['ko'], function (ko) {
    'use strict';

    if (typeof window !== 'undefined' && window.gphpDeferKoApplyBindings === false) {
        return ko;
    }

    var original = ko.applyBindings;

    ko.applyBindings = function (viewModelOrBindingContext, rootNode) {
        /* Document / no root: keep synchronous (initial app shell, same as conceptual example). */
        if (!rootNode) {
            return original.call(ko, viewModelOrBindingContext, rootNode);
        }

        var fn = function () {
            original.call(ko, viewModelOrBindingContext, rootNode);
        };

        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(fn, { timeout: 2000 });
        } else {
            setTimeout(fn, 0);
        }
    };

    return ko;
});
