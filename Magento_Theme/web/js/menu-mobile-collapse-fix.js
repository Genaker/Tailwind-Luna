/**
 * Fix mobile drawer category menu: core _toggleMobileMode binds two click handlers.
 * The second (click .ui-menu-item:has(.ui-state-active)) calls collapseAll on every
 * tap of a focused parent item, undoing expand — submenus never stay open.
 *
 * ARIA: jQuery UI puts role=menuitem on <a> inside <li>. <li> must not stay a listitem
 * between menu and menuitem — set role=none on li.ui-menu-item (axe / Lighthouse).
 *
 * @see lib/web/mage/menu.js _toggleMobileMode
 */
define(['jquery'], function ($) {
    'use strict';

    return function (menuModule) {
        var MenuConstructor = menuModule.menu;

        $.widget('mage.menu', MenuConstructor, {
            _init: function () {
                this._super();
                this._fixMenuItemListRoles();
            },

            refresh: function () {
                this._super();
                this._fixMenuItemListRoles();
            },

            /**
             * Required parent chain: role=menu &gt; role=menuitem. Prune listitem wrappers.
             */
            _fixMenuItemListRoles: function () {
                this.element.find('.ui-menu-item').attr('role', 'none');
            },

            _toggleMobileMode: function () {
                var subMenus;

                $(this.element).off('mouseenter mouseleave');
                this._on({
                    'click .ui-menu-item:has(a)': function (event) {
                        var target;

                        event.preventDefault();
                        target = $(event.target).closest('.ui-menu-item');
                        if (target.length && target.get(0)) {
                            target.get(0).scrollIntoView();
                        }

                        if (target.has('.ui-menu').length) {
                            this.select(event);
                            this.expand(event);
                        } else if (!this.element.is(':focus') &&
                            $(this.document[0].activeElement).closest('.ui-menu').length
                        ) {
                            this.element.trigger('focus', [true]);

                            if (this.active && this.active.parents('.ui-menu').length === 1) {
                                clearTimeout(this.timer);
                            }
                        }

                        if (!target.hasClass('level-top') || !target.has('.ui-menu').length) {
                            window.location.href = target.find('> a').attr('href');
                        }
                    }
                });

                subMenus = this.element.find('.level-top');
                $.each(subMenus, $.proxy(function (index, item) {
                    var $item = $(item),
                        category = $item.find('> a span').not('.ui-menu-icon').text(),
                        categoryUrl = $item.find('> a').attr('href'),
                        menu = $item.find('> .ui-menu'),
                        categoryLink,
                        categoryParent;

                    if (!menu.length) {
                        return;
                    }

                    categoryLink = $('<a>')
                        .attr('href', categoryUrl)
                        .text($.mage.__('All %1').replace('%1', category));

                    categoryParent = $('<li>')
                        .addClass('ui-menu-item all-category')
                        .html(categoryLink);

                    if (menu.find('.all-category').length === 0) {
                        menu.prepend(categoryParent);
                    }
                }, this));

                this._fixMenuItemListRoles();
            }
        });

        menuModule.menu = $.mage.menu;
        return menuModule;
    };
});
