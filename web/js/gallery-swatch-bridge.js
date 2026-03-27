/**
 * Swatch → gallery bridge.
 *
 * #conf-gallery is keyed by child simple product ID (full variant).
 * #gphp-config-index carries jsonConfig.index (childId → { attrId: optionValueId }).
 *
 * On swatch / super-attribute change: collect selected option ids, find a child product whose
 * index row matches every selected attribute, then stageEl.innerHTML = confGallery[childId] +
 * gallery.refreshState(). If only some attrs are selected, any matching child is fine — we use
 * the lowest child id (first variant) so the gallery still updates (e.g. color only → first size).
 */
(function () {
    'use strict';

    function getGallery() {
        var g = window.gphpGalleries || {};
        var root = document.querySelector('[data-gphp-gallery]');
        if (root && root.id) {
            var m = /^product-gallery-(\d+)$/.exec(root.id);
            if (m && g[m[1]]) {
                return g[m[1]];
            }
        }
        var k = Object.keys(g);
        return k.length ? g[k[0]] : null;
    }

    function readBlob(id) {
        var el = document.getElementById(id);
        if (!el) { return null; }
        try { return JSON.parse(el.textContent || ''); } catch (e) { return null; }
    }

    /**
     * Build map { attributeId: optionValueId } from visible swatches + selects.
     */
    function collectSelectedMap() {
        var map = {};

        document.querySelectorAll('.swatch-attribute[data-attribute-id]').forEach(function (attrEl) {
            var aid = attrEl.getAttribute('data-attribute-id');
            if (!aid) { return; }
            var sel = attrEl.querySelector('.swatch-option.selected');
            if (sel) {
                var oid = sel.getAttribute('data-option-id') || sel.getAttribute('option-id') || '';
                if (oid) { map[aid] = oid; }
            }
        });

        document.querySelectorAll('select.super-attribute-select').forEach(function (selEl) {
            var name = selEl.getAttribute('name') || '';
            var m = name.match(/super_attribute\[(\d+)\]/);
            if (m && selEl.value) { map[m[1]] = selEl.value; }
        });

        document.querySelectorAll('input.super-attribute-select[type="hidden"]').forEach(function (inp) {
            var name = inp.getAttribute('name') || '';
            var m = name.match(/super_attribute\[(\d+)\]/);
            if (m && inp.value) { map[m[1]] = inp.value; }
        });

        return map;
    }

    /**
     * Find child product id where index[childId] matches every entry in selectedMap.
     * Partial selection: any child that agrees on selected attrs qualifies; ties → lowest child id.
     */
    function findMatchingChildId(index, selectedMap) {
        var keys = Object.keys(selectedMap);
        if (!index) { return null; }

        if (!keys.length) { return null; }

        var matches = [];
        for (var childId in index) {
            if (!Object.prototype.hasOwnProperty.call(index, childId)) { continue; }
            var row = index[childId];
            var ok = true;
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                var rv = row[k] !== undefined && row[k] !== null ? String(row[k]) : '';
                if (rv !== String(selectedMap[k])) {
                    ok = false;
                    break;
                }
            }
            if (ok) { matches.push(childId); }
        }
        if (!matches.length) { return null; }
        matches.sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });
        return matches[0];
    }

    function applyGalleryForSelection(confGallery, index, stageEl) {
        var g = getGallery();
        if (!g || !stageEl || !confGallery) { return; }

        var childId = findMatchingChildId(index, collectSelectedMap());
        var entry = childId && confGallery[childId] ? confGallery[childId] : null;

        if (entry) {
            stageEl.innerHTML = entry.html;
            g.refreshState(entry.items, entry.mainIndex);
        } else {
            g.reset();
        }
    }

    function init() {
        var confGallery = readBlob('conf-gallery');
        var idxBlob     = readBlob('gphp-config-index');
        var index       = idxBlob && idxBlob.index ? idxBlob.index : null;

        if (!confGallery) { return; }

        var root    = document.querySelector('[data-gphp-gallery]');
        var stageEl = root && root.querySelector('[data-gphp-stage]');
        if (!stageEl) { return; }

        function scheduleApply() {
            /* Magento’s swatch-renderer often updates .selected / inputs after this tick; 0ms races it. */
            setTimeout(function () {
                applyGalleryForSelection(confGallery, index, stageEl);
            }, 50);
        }

        document.addEventListener('click', function (e) {
            var sw = e.target.closest && e.target.closest('.swatch-option');
            if (!sw) { return; }
            scheduleApply();
        });

        document.addEventListener('change', function (e) {
            var t = e.target;
            if (!t || !t.matches) { return; }
            if (t.matches('select.super-attribute-select')) {
                scheduleApply();
            }
        });

        /* Pre-selected defaults (e.g. size+color) — sync gallery once RequireJS/swatches apply. */
        setTimeout(function () {
            applyGalleryForSelection(confGallery, index, stageEl);
        }, 150);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
