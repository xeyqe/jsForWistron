// ==UserScript==
// @name         lighting/canon button
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  copies ssh root@<ether ip> to clipboard
// @author       You
// @match        http://*/nodes/*/log
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var button = document.createElement("button");
    button.innerHTML = "c";
    $('#ether').append(button);

    button.addEventListener("click", function(){
        copyIP(button);
    });

    var copyIP = function(object) {
        var copyText = $('#ether').text();
        copyText = copyText.match(/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/gm)[0];
        copyText = "ssh root@" + copyText;

        var $temp = $("<input>");
        $("body").append($temp);
        $temp.val(copyText).select();
        document.execCommand("copy");
        $.growl.notice({ message: "Copied the text: " + $temp.val() });
        $temp.remove()
    }
})();