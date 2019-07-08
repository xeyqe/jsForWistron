// ==UserScript==
// @name         leopard
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  helps scan leopards
// @author       Vit Markovic
// @match        http://10.82.143.231/sn_mapping.php
// ==/UserScript==

(function() {
    'use strict';

    function submitScanIn(){
        if(!(document.getElementById("select_rk").value == '' || document.getElementById("text_pos").value == '' ||
             document.getElementById("text_sys_sn").value == '' || document.getElementById("text_sys_pn").value == '' ||
             document.getElementById("text_fb_atag").value == '' || document.getElementById("text_mac").value == '' ||
             document.getElementById("text_oper_id").value == '')) {

            var rackNumber = document.getElementById('select_rk').value;
            var location = document.getElementById('text_pos').value;
            var cId = document.getElementById('text_oper_id').value;

            location = nextLocation(location);

            sessionStorage.setItem('rackNuStorage', rackNumber);
            sessionStorage.setItem('locationStorage', location);
            sessionStorage.setItem('ceckoStorage', cId);
            sessionStorage.setItem('focus', 'in');

            var form = document.getElementById("form_sn_map");
            form.method = "post";
            form.submit();
        }
    }

    function submitScanOut() {
        var odhlaseni = document.getElementsByName("SNPOS")[0].value;
        var rack = odhlaseni.split("_")[0];
        var location = odhlaseni.split("_")[1];
        location = nextLocation(location);
        sessionStorage.setItem('odhlaseniStorage', rack + '_' + location);
        sessionStorage.setItem('focus', 'out');
    }

    function nextLocation(loc){
        var raw = loc.match(/\d+/)[0];
        var cell = loc.match(/\d+-(\d+)/)[1];

        if (cell < 3) {
            cell++;
        } else {
            cell = 1;

            if (raw > 1) {
                raw--;
            } else {
                raw = '';
                cell = '';
            }
        }
        if (raw) {
            return raw + '-' + cell;
        } else {
            return '';
        }
    }

    function loadFromStorage(storage){
	    if (sessionStorage.getItem(storage)) {
	        return sessionStorage.getItem(storage);
        } else return '';
	}

    function loadInitialValues() {
        var rackNumber = loadFromStorage("rackNuStorage");
        var location = loadFromStorage("locationStorage");
        var cId = loadFromStorage("ceckoStorage");
        var odhlaseni = loadFromStorage('odhlaseniStorage');

        if(!rackNumber) {
            rackNumber = 'RK01';
        }

        document.getElementById('select_rk').value = rackNumber;
        document.getElementById('text_pos').value = location;
        document.getElementById('text_oper_id').value = cId;
        document.getElementsByName('SNPOS')[0].value = odhlaseni;

        if(sessionStorage.getItem('focus') === 'out') {
            document.getElementsByName('SNPOS')[0].focus();
        } else {
            document.getElementById('text_sys_sn').focus();
        }
    }

    function onPressEnter() {
        var last = document.getElementById('text_mac');
        last.addEventListener("keydown", function(e) {
            if (e.keyCode === 13) {
                submitScanIn();
            }
        });

        var out = document.getElementsByName('SNPOS')[0];
        out.addEventListener("keydown", function(e) {
            if (e.keyCode === 13) {
                submitScanOut();
            }
        });
    }

    function startup() {
        loadInitialValues();
        onPressEnter();
    }

    startup();
})();