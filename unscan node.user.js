// ==UserScript==
// @name         unscan node
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  helps with manual unscanning
// @author       Vit Markovic
// @match        http://*/scanout/node
// ==/UserScript==

(function() {
    'use strict';
    var $ = jQuery;

    var button = $('.btn.btn-danger.btn-sm');
    var input = $('#sn');
    var destination = $('.panel-body');

    if(destination) {
        destination.append(input);
        destination.append(button);
    }

    $('.panel').css({'width':'50%',
                     'position':'relative',
                     'left':'280px'
                    });
})();