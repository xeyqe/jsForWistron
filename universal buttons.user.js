// ==UserScript==
// @name         universal buttons
// @namespace    http://tampermonkey.net/
// @version      5.4
// @description  unscans and scrolls
// @author       Vit Markovic
// @include      http://*/monitor
// ==/UserScript==

(function() {
    'use strict';

    var $ = jQuery;

    var what2unscan = "L10Pass"; //"ResultPass";
    var L11StepNum = 0;
    var tiogaL11RackNum = '10';
    var yosemiteL11RackNum = '14';

    // global scrolling variables
    var scrolledPXTioga = '';
    var scrolledPXAll = '';
    var scrolledPXYosemite = '';
    var number = 0;
    var time = new Date().getTime();

    var codeOfAjaxHeader = $('html').html()
    .match(/headers: {"X-CSRF-TOKEN": '([0-9A-Za-z]+)'}/)[1];

    // copied from http://10.82.143.233/scanout/node
    /*var submitScanOut = function(snToUnscan) {
        //var promise = new Promise(function(resolve) {
            var data = {};
            var sn = snToUnscan;

            if (sn === '')
                return false;

            var d = new Date();
            var datetime = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + ' ' + d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds();

            data['deleted_at'] = datetime;

            $.ajax({
                headers: {"X-CSRF-TOKEN": codeOfAjaxHeader},
                type: 'DELETE',
                url: '/nodes/' + sn,
                data: data
            }).done(function(msg) {
                if (msg.result) removeAttributesFromElement(snToUnscan);// $.growl.notice({ message: msg.content });
                else $.growl.warning({ message: msg.content });
            }).fail(function(jqXHR, textStatus) {
                $.growl.error({ message: "error with " + jqXHR.status});
            //}).always(function(){
              //  resolve();
            });
        //});
        //return promise;
    }
*/
    function secondToHms(secs) {
        var date = new Date(null);
        date.setSeconds(secs);
        return date.toISOString().substr(11,8);
    }

    var updateRacks = function () {
        $('.RackTable').each(function(){
            var rack = this;
            if (!rack) return;

            var state = $('#state').val()
            var loc = 'RK-' + getRackNum(rack);
            var snInPreUpdatedMonitor = [];
            $(rack).find('td[id]').each(function(){
                snInPreUpdatedMonitor.push($(this).attr('id'));
            });

            //$('#refresh').attr('disabled', 'disabled');

            $.ajax({
                headers: {"X-CSRF-TOKEN": codeOfAjaxHeader},
                type: 'GET',
                url: '/monitor/racks?location=' + loc,
            }).done(function(msg) {

                for (const nodeSn of snInPreUpdatedMonitor) {
                    if (typeof(msg.tasks[nodeSn]) == 'undefined') {
                        removeAttributesFromElement(nodeSn);
                    }
                }

                for (var node_sn in msg.tasks) {
                    var task_result = msg.tasks[node_sn][0];
                    var task = msg.tasks[node_sn][1] + '/' + msg.tasks[node_sn][2];
                    var cur_task = msg.tasks[node_sn][3];
                    var timeout = msg.tasks[node_sn][4];
                    var hms = ($.isNumeric(timeout)) ? secondToHms(timeout) : timeout + " sec";
                    var title = 'System SN: ' + node_sn + "\nLast Test Item: " +
                        cur_task + "\nTimeout: " + hms;
                    var $node = $('#' + node_sn);

                    if(task_result !== "Idle"){
                        //if (!$node.find('a').length) $node.attr('href', '/nodes/' + node_sn + '/log')
                        $node.find('a').text(task);
                        $node.find('a').attr('href', '/nodes/' + node_sn + '/log');
                    } else{
                        $node.find('a').text(node_sn);
                        $node.find('a').removeAttr('href');
                    }
                    $node.attr('title', title).removeClass().addClass(task_result);
                }


            }).fail(function(jqXHR, textStatus) {
                $.growl.error({ message: "error with " + jqXHR.status });
            }).always(function(){
                //$('#refresh').removeAttr('disabled');
            });
        });
        if (localStorage.getItem('scripts') === 'on') {
            $('.RackTable:contains(RK-'+yosemiteL11RackNum+') '+
              '.ModelTable:first td:contains(phoenix_yosemite_v2_l10)')
                .css({'background':'#1c1b1b'}).text('L11');
            $('.RackTable:contains(RK-'+tiogaL11RackNum+') '+
              '.ModelTable:lt(2) td:contains(tioga_pass)')
                .css('background','#1c1b1b').text('L11');
        }
    }

    var getNodeInfo = function (node_sn) {
        var promise = new Promise(function(resolve, reject) {
            if (node_sn === '') return false;
            var model_id = modelNumFromSN(node_sn);
            if (!model_id) return false;

            $.ajax({
                headers: {"X-CSRF-TOKEN": codeOfAjaxHeader},
                type: 'GET',
                url: '/nodes/' + node_sn + '?model_id=' + model_id,
            }).done(function(msg) {
                if (!msg.result) {
                    $.growl.warning({ message: msg.content });
                    return false;
                }

                resolve(msg.data);

            }).fail(function(jqXHR, textStatus) {
                $.growl.error({ message: "error with " + jqXHR.status});
                reject();
            });
        });
        return promise;
    }

    function showAllUnitScannedCodes(data) {
        var promise = new Promise((resolve)=> {
            console.log(data);
            var map = new Map();
            var string = '';

            for (const table in data) {
                for (const code in data[table]) {
                    if (data[table][code]) {
                        map.set(code, data[table][code]);
                    }
                }
            }

            resolve(map);
        });
        return promise;
    }

    function addHoldActionToUnitsTd() {
        var pressTimer;
        var done = false;

        $('td[id]:not(.Idle) a').removeAttr('href');

        $('td[id]:not(.Idle) a').mousedown(function(){
            done = false;
            pressTimer = window.setTimeout(()=>{
                var sn = $(this.parentElement).attr('id');
                var map = getNodeInfo(sn)
                .then(showAllUnitScannedCodes)
                .then(arrangeAllUnitScannedCodes)
                .then(()=> {
                    done = true;
                });
            },1000);
            return false;
        }).mouseup(function() {
            clearTimeout(pressTimer);
            if (!done) {
                window.open('/nodes/' + $(this.parentElement)
                            .attr('id') + '/log');
            }
            return false;
        });
    }

    function arrangeAllUnitScannedCodes(map) {
        var promise = new Promise((resolve)=>{
            console.log(map);
            if (map.has('lower_unit')) {var lower_unit = map.get('lower_unit')};
            if (map.has('higher_unit')) {var higher_unit = map.get('higher_unit')};
            if (map.has('slot_id')) {var slot_id = map.get('slot_id')};
            if (typeof(slot_id) === 'undefined') slot_id = '0';
            const position = lower_unit+'-'+higher_unit+' ['+slot_id+']';
            map.set('position', position);
            if (map.has('0')) {const mac = map.get('0').address;
            map.set('mac', mac);}
            var string = '';

            const codesNameArray = ['rack_sn', 'oper_id', 'node_sn', 'node_pn',
                                    'position', 'up_tray_sn', 'fb_atag', 'up_tray_atag',
                                    'up_tray_fbpn', 'down_tray_sn',
                                    'down_tray_pn', 'fb_pn', 'down_tray_atag',
                                    'down_tray_fbpn', 'mac', 'extra1'];

            if (map.get('node_sn').charAt(0) != '1') {
                const index = codesNameArray.indexOf('mac');
                codesNameArray.splice(index, 1);
            }

            for (let codename of codesNameArray) {
                if (map.has(codename)) {
                    string = string + '\n' + map.get(codename);// + ' '.repeat(16-map.get(codename).length) + '(' +codename +')';
                }
            }
            console.log(string);
            alert(string);
            resolve();
        });
        return promise;
    }

    function search(searchValue) {
        $('.RackTable td[id]').each(function() {
            var sn = $(this).attr('id');
            console.log(sn);
            getNodeInfo(sn)
                .then(showAllUnitScannedCodes)
                .then((myMap)=>{
                if (Array.from(myMap.values()).includes(searchValue)) {
                    $('#'+sn).css('border', '5px red solid');
                }
            })
        });
    }


    if (localStorage.getItem('theme') === 'on' ||
        localStorage.getItem('scripts') === 'on') {
        getRacks = ((select,element)=> {
            var cached_function = getRacks;
            return function() {
                var result = cached_function.apply(element, arguments);
                waitTillLoad();
                return result;
            }
        })();

        getModel = ((select, element)=>{
            var cached_function = getModel;
            return function() {
                var result = cached_function.apply(element, arguments);
                initialDialogCheckout();
                return result;
            }
        })();
    }

    function type() {
        var TYPE = $('.sub_title').text();
        if (TYPE.includes("TP / YMv2 L10")) {
            TYPE = "tioga";
        } else if (TYPE.includes("[WCZ] BC L10")) {
            TYPE = "canon";
        } else if (TYPE.includes("StorageL10 - LTN/Knox")) {
            TYPE = "lightning";
        }
        return TYPE;
    }

/*
####################################################################################################
#                                     UNSCANNING PART                                              #
####################################################################################################
*/
    function unscan() {
        var racksTioga = $('.RackTable:contains(Phoenix_TP_L10)');
        var racksYosemite = $('.RackTable:contains(Phoenix_Yosemite_v2_L10)');
        var racksCanon = $('.RackTable:contains(BC_Type5_L10)');
        var racksLighting = $('.RackTable:contains(Phoenix_LTN_L10)');
        var model = "";
        var list = [racksTioga, racksYosemite, racksCanon, racksLighting];

        for (const x of list) {
            if(x.length) {
                $(x).each((i, element)=>{
                    if (x == racksTioga) model = 'tioga';
                    else if(x == racksYosemite) model = 'yosemite';
                    else if (x == racksCanon) model = 'canon';
                    else if (x == racksLighting) model = 'lightning';

                    createButtons(element, model);
                });
            }
        }
    }

    function removeAttributesFromElement(sn) {
        var element = $('#'+sn)[0];
        const list = element.attributes;
        //const sn = element.getAttribute('id');
        getNodeInfo(sn)
            .then(showAllUnitScannedCodes)
            .then((map)=>{
            var color = 'black';

            const modelId = map.get('model_id');
            let lowerUnit = map.get('lower_unit');
            const higherUnit = map.get('higher_unit');
            var slotId = map.get('slot_id');
            if (typeof(slotId) === 'undefined') slotId = '0';

            for (const attribute of list) {
                if (attribute.name !== 'id') {
                    element.removeAttribute(attribute.name);
                }
            }
            //$(element).find('a').remove();
            $(element).find('a').removeAttr('href');
            $(element).addClass((lowerUnit).toString() + (slotId).toString().charAt(1) + (slotId).toString().charAt(0));
            $(element).on('click', function(event) {
                getModel(this, modelId, lowerUnit, higherUnit, slotId);
            });

            $(element).text(typeFromSn(sn));
            if (localStorage.getItem('theme') === 'on') color = 'white';
            $(element).attr('style',
                            'width: 33.3333%; cursor: pointer; border: 2px solid '+
                            color+'; font-size: 13px');

            element.removeAttribute('id');

        });
    }

    function typeFromSn(sn) {
        var tdText = '';
        if (sn.charAt(0) === 'B') tdText = 'yosemite';
        else if (sn.charAt(0) === 'W') tdText = 'tioga_pass';
        else if (sn.charAt(0) === 'T') tdText = 'lightnint';
        else if (sn.charAt(0) === '1') tdText = 'TYPE5_L10';

        return tdText;
    }


    function getRackNum(rack) {
        var rackNum = $(rack).find('.RackArea').text();
        rackNum = rackNum.match(/RK-(\d+)/)[1];
        return rackNum;
    }

    function createButtons(rack, model) {
        var rackNum = getRackNum(rack);
        var unscanAll = document.createElement("button");
        unscanAll.innerHTML = "unscanAll";
        $(unscanAll).css({'padding':'6px','background':'#ac0c0c',
                       'color':'#ffffff'});

        var buHide = document.createElement("button");
        buHide.innerHTML = 'X';
        $(buHide).css({'float':'right','background':'#ac0c0c',
                       'color':'#ffffff'});
        var buUnhide = document.createElement("button");
        buUnhide.innerHTML = rackNum;
        $(buUnhide).css({'float':'left','background':'#ac0c0c',
                         'color':'#ffffff'});

        $(buUnhide).on("click", function() {
            this.replaceWith(rack);
            $(rack).fadeToggle();
        });

        $(buHide).on("click", function() {
            $(rack).fadeToggle(1000);
            $(buUnhide).insertBefore(rack);
        });

        unscanButtonFunc(unscanAll, rack, model);

        var titleLine = $(rack).find('.btn.btn-default'+
                                     '.btn-xs.btn-circle')[0].parentElement;

        titleLine.appendChild(unscanAll);
        titleLine.appendChild(buHide);
    }

    function unscanButtonFunc(button, rack, model) {
        var pressTimer;
        var done = false;
        $(button).mousedown(function(){
            done = false;
            pressTimer = window.setTimeout(()=>{
                unscanAll(rack).then(scanout).then(()=>updateRacks()); done = true;},1000);
            return false;
        }).mouseup(function() {
            clearTimeout(pressTimer);
            if (!done) unscanButtonClickFunc(rack, model);
            return false;
        });
    }

    var unscanAll = function(rack) {
        var promise = new Promise(function(resolve) {
            var listOfIdToUnscan = [];
            var toUnscan = '';
            if (type() === "lightning") {
                toUnscan = $(rack)
                    .find('.ModelTable:not(:first, :eq(1)) td[id]');
            } else toUnscan = $(rack).find('td[id]');

            if (toUnscan.length) {
                if (window.confirm('Chceš odskenovat úplně všechny? I ty nehotové?')) {
                    toUnscan.each(function(){listOfIdToUnscan.push($(this).attr('id'))});
                    resolve(listOfIdToUnscan);
                }
            }
        });
        return promise;
    }

    function unscanButtonClickFunc(rack, model) {
        var func;
        var isRackNotEmpty;
        switch (model) {
            case "tioga":
                func = tiogaFunction(rack);
                break;
            case "yosemite":
                func = yosemiteFunction(rack);
                break;
            case "canon":
                    func = canonFunction(rack);
                break;
            case "lightning":
                    func = lightningFunction(rack);
                break;
            default:
                console.log('hej');
        }

        if (type() === 'lightning') {
            isRackNotEmpty = $(rack).find(".ModelTable:not(:first, :eq(1))")
                .find('td[id]').length;
        } else isRackNotEmpty = $(rack).find('td[id]').length;

        if (isRackNotEmpty) {
            return func.then(scanout)
                 .then(()=>{
                updateRacks();
            });
        } else return false;
    }

    var tiogaFunction = function(rack) {
        var promise = new Promise((resolve, reject)=> {
            var rackNum = getRackNum(rack);
            var toScanout = [];
            var pretoScanout = [];
            var rows = '';

            if (rackNum == tiogaL11RackNum) { // in RK-10 you have to exclude L11
                pretoScanout = $(rack).find(".ModelTable:not(:first, :eq(1))")
                    .find('.'+what2unscan);
                var L11LinesFinishedUnits = $(rack)
                .find(".ModelTable:first, .ModelTable:eq(1)")
                .find('.'+what2unscan);

                if (L11LinesFinishedUnits.length) {
                    if (window.confirm('Chceš odskenovat i L11 řady?')) {
                        $(L11LinesFinishedUnits).each((i, element)=>{
                            toScanout.push(element.getAttribute('id'));
                        });
                    }
                }
            } else pretoScanout = $(rack).find('.'+what2unscan);

            $(pretoScanout).each((i, element)=>{
                toScanout.push(element.getAttribute('id'));
            });

            if (toScanout.length) resolve(toScanout);
            else reject();
        });
        return promise;
    }

    var yosemiteFunction = function(rack) {
        var promise = new Promise((resolve, reject)=> {

            var lines = '';
            var count = lines.length;
            var toScanout = [];
            var rackLabel = getRackNum(rack);

            if (rackLabel === yosemiteL11RackNum) {
                lines = $(rack).find('.ModelTable:not(:first)');
                var L11Line = $(rack).find('.ModelTable:first');
                if ($(L11Line).find('.'+what2unscan).length > 3) {
                    if (window.confirm('Chceš odskenovat i L11 řadu?')) {
                        toScanout.push(yosemite(L11Line[0]));
                    }
                }
            } else {
                lines = $(rack).find('.ModelTable');
            }

            $(lines).each((i,element)=>{
                if ($(element).find('.'+what2unscan).length > 3) {
                    toScanout.push(yosemite(element));
                }
            });

            var output = [];
            for (const x of toScanout)
                for (const y of x)
                    for (const z of y)
                        output.push(z);

            if (output.length > 3) resolve(output);
            else reject();
        });
        return promise;
    }

    function yosemite(modelTable) {
        var toScanout = [];
        // stacks of SN for individual positions
        let lightningA = [];
        let lightningB = [];
        let lightningC = [];
        let lightningD = [];

        for (let j=0, row; row = modelTable.rows[j]; j++) { //individual rows in modeltable
            for (let k=0, col; col = row.cells[k]; k++) { //individual cell in row
                if (col != null) {

                    let a = col.getAttribute("class");
                    let id = col.getAttribute("id");
                    switch (k){
                        case 0:
                            if (a == what2unscan) lightningA.push(id);
                            break;
                        case 1:
                            if (a == what2unscan) lightningB.push(id);
                            break;
                        case 2:
                            if (a == what2unscan) lightningC.push(id);
                            break;
                        case 3:
                            if (a == what2unscan) lightningD.push(id);
                            break;
                        default:
                            console.log(id);
                    }
                }
            }
        }
        if (lightningA.length == 4) toScanout.push(lightningA);
        if (lightningB.length == 4) toScanout.push(lightningB);
        if (lightningC.length == 4) toScanout.push(lightningC);
        if (lightningD.length == 4) toScanout.push(lightningD);
        return toScanout;
    }

    var canonFunction = function(rack) {
        var promise = new Promise((resolve, reject)=> {
            var toScanout = [];
            var pretoScanout = [];
            var count = null;

            var rows = $(rack).find('.ModelTable');
            $(rows).each((i, element)=>{
                if (element != null) {
                    pretoScanout = $(element).find('.'+what2unscan);
                    if (pretoScanout.length === 2) {
                        $(pretoScanout).each((i,element)=> {
                            toScanout.push(element.getAttribute('id'));
                        });
                    }
                }
            });
            if (toScanout.length > 1) resolve(toScanout);
            else reject();
        });
        return promise;
    }

    var lightningFunction = function(rack) {
        var promise = new Promise((resolve, reject)=>{

            var toScanout = [];
            var A = [];
            var B = [];
            var C = [];
            var siblingText = "";

            var pretoScanout = $(rack).find('.'+what2unscan);

            $(pretoScanout).each((i,element)=>{
                siblingText = element.parentElement.parentElement.parentElement.
                parentElement.parentElement.childNodes[0].innerHTML;
                if (siblingText === "2-2" || siblingText === "3-3") {
                    A.push(element.getAttribute('id'));
                } else if (siblingText === "5-5" || siblingText === "6-6") {
                    B.push(element.getAttribute('id'));
                } else if (siblingText === "8-8" || siblingText === "9-9") {
                    C.push(element.getAttribute('id'));
                }
            });
            if (A.length === 2) {
                toScanout.push(A[0]);
                toScanout.push(A[1]);
            }
            if (B.length === 2) {
                toScanout.push(B[0]);
                toScanout.push(B[1]);
            }
            if (C.length === 2) {
                toScanout.push(C[0]);
                toScanout.push(C[1]);
            }
            if (toScanout.length) resolve(toScanout);
            else reject();
        });
        return promise;
    }

    var scanout = function(input) {
/*         for (const x of input) {
            console.log(x);
        } */
        //var promise = new Promise(async function(resolve) {
            var toScanout = input;
            for (const x of toScanout) {
                submitScanOut(x);
            }
            //resolve();
        //});
        //return promise;
    }

/*
####################################################################################################
#                                      SCROLLING PART                                              #
####################################################################################################
*/
    function createKeyboardShortcuts() {
        document.onkeyup = function(e) {
            if (e.altKey && e.shiftKey && e.which == 88) { //shift+alt+x
                //primaryScroll();
                updateRacks();
            } else if (type() === "tioga" && e.altKey &&
                       e.shiftKey && e.which == 90) { //shift+alt+z
                if (dontWorryIWillNameYouLater() === 'tioga')
                    primaryScroll(3);
                else primaryScroll(1);
            } else if (type() !== 'canon' && e.altKey &&
                       e.shiftKey && e.which == 65) { //shift+alt+a
                var SN = window.prompt('SN to get log of');
                if (SN != null) {
                    var url = "nodes/" + SN + "/log"
                    window.open(url);
                }
            } else if (e.altKey && e.shiftKey && e.which == 67) { //shift+alt+c
                var searchInput = window.prompt('Napiš mi sem nějaký kód, podle '+
                                                'kterého mám vyhledávat.\n'+
                                                '(Pozor, kód musí být úplný.)');
                if (searchInput) search(searchInput);
                //$('.RackTable td[id]').each(function(){removeAttributesFromElement($(this).attr('id'))});

            }
        }
    }

    function createPrimaryButton() {
        var button = document.createElement("button");
        button.innerHTML = type();
        $(button).css({'position':'fixed','background':'#ac0c0c',
                       'color':'#ffffff','right':'0%',
                       'height':'30px'});

        document.body.appendChild(button);

        if (type() === "tioga") {
            $(button).css('bottom','30px');
        } else {
            $(button).css('bottom','1px');
        }

        $(button).on("click", function(){
            if (type() === 'lightning') primaryScroll();
            else primaryScroll(1);
        });
    }

    function createYosemiteScrollBu() {
        if (type() === "tioga") {
            var button = document.createElement("button");
            button.innerHTML = "yosemite";
            $(button).css({'position':'fixed','background':'#ac0c0c',
                           'color':'#ffffff','right':'0%','height':'30px'});
            button.style.bottom = "1px";
            button.setAttribute('id', 'buYosemiteScroll');

            document.body.appendChild(button);

            $(button).on("click", function() {
                primaryScroll(3);
            });
        }
    }

    function dontWorryIWillNameYouLater() {
        var countOfTiogaRacks = $('.RackTable:contains(Phoenix_TP_L10)').length;
        var countOfYosemiteRacks = $('.RackTable:contains'+
                                     '(Phoenix_Yosemite_v2_L10)').length;
        var output = '';

        if (countOfTiogaRacks && !countOfYosemiteRacks) {
            output = 'tioga';
        } else if (!countOfTiogaRacks && countOfYosemiteRacks) {
            output = 'yosemite';
        } else {
            output = 'all';
        }
        return output;
    }

    function scrollValues() {
        var tiogaORyosemite = dontWorryIWillNameYouLater();
        if (tiogaORyosemite === 'tioga') scrolledPXTioga = pageYOffset;
        else if (tiogaORyosemite === 'yosemite') scrolledPXYosemite = pageYOffset;
        else scrolledPXAll = pageYOffset;
    }

    function scrollPX() {
        var tiogaORyosemite = dontWorryIWillNameYouLater();
        var number = '';

        if (tiogaORyosemite === 'tioga') number = scrolledPXTioga;
        else if (tiogaORyosemite === 'yosemite') number = scrolledPXYosemite;
        else number = scrolledPXAll;

        if (number == 0) {
            number = 300;
        }
        return number;
    }

    function primaryScroll(model) {
        if ($('.blockUI.blockOverlay').length === 0) {
            var tiogaORyosemite = dontWorryIWillNameYouLater();
            var modelNum = '';

            if (tiogaORyosemite === 'tioga') modelNum = "1";
            else if (tiogaORyosemite === 'yosemite') modelNum = "3";
            else modelNum = "All";

            if (model) {
                modelNum = model;
            }

            scrollValues();
            sendGetRackReq(modelNum);
            waitTillLoad();
        }
    }

    function waitTillLoad(SCROLL) {
        var waitTill = setInterval(()=>{
            if ($('.RackTable').length !== 0 ||
                $('.blockUI.blockOverlay').length === 0) {
                clearInterval(waitTill);
                if (localStorage.getItem('scripts') === 'on') {
                    if (SCROLL && SCROLL !== null) scroll(0, SCROLL);
                    else scroll(0, scrollPX());
                    unscan();
                    var racks = $('.RackTable');
                    reversableHide(racks);
                    time = new Date().getTime();

                    $('.ModelTable .Idle').on('click', function(){
                        var sn = $(this).attr('id');
                        getNodeInfo(sn)
                            .then(showAllUnitScannedCodes)
                            .then(arrangeAllUnitScannedCodes);
                    });
                    addHoldActionToUnitsTd();
                }
                if (localStorage.getItem('theme') === 'on') {
                    theme();
                }
            }
        }, 100);
    }

    function reversable(rack) {
        var promise = new Promise((resolve)=> {
            var rackLabel = getRackNum(rack);
            var buUnhide = document.createElement("button");
            buUnhide.innerHTML = rackLabel;
            $(buUnhide).css({'background':'#ac0c0c',
                             'color':'#ffffff',
                             'float':'left'});

            $(buUnhide).on("click", function() {
                $(rack).fadeToggle();
                this.replaceWith(rack);
            });

            $(rack).fadeToggle();
            $(buUnhide).insertBefore(rack);
            resolve();
        });
        return promise;
    }

    async function reversableHide(racks) {
        for (let i=0; i<racks.length; i++) {
            if (type() === "lightning") {
                if (!$(racks[i])
                    .find('.ModelTable:not(:first, :eq(1)) td[id]').length) {
                    await reversable(racks[i]);
                }
            } else {
                if (!$(racks[i]).find('.ModelTable td[id]').length) {
                    await reversable(racks[i]);
                }
            }
        }
    }

    function theme() {
        if (localStorage.getItem('theme') === 'on') {
            $('.RackTable').css('margin', '0cm');
            $('.panel').css('width', '100%');
            $('.RackArea').css('display', 'none');
            $('.UnitTag').css('background', 'black');
            $('.RackTag').css({'background':'#333131', 'color':'white',
                               'border-top-left-radius':'20px',
                               'border-top-right-radius':'20px',
                               'text-align':'center'});
            $('.panel-footer').css('display', 'none');
            $('.ModelTable').css({'border':'3px #333131 solid',
                                  'border-left-width':'10px',
                                  'border-right-width':'10px'});
            $('.EmptyTable').css({'border-left':'10px #333131 solid',
                                  'border-right':'10px #333131 solid'});
            $('.ModelTable td').css('border', '2px white solid');
            $('#rackBody div').css('display', 'none');

            if (window.matchMedia('(min-width: 767px)').matches) {
                $('.RackTable:contains(Phoenix_LTN_L10)').css('width', '34%');
                $('.RackTable:contains(BC_Type5_L10)').css('width','25%');
                $('.RackTable:contains(Phoenix_Yosemite_v2_L10)').css('width', '30%');
                $('.RackTable:contains(Phoenix_TP_L10)').css('width', '25%');
            }

            $('td:contains("33-34")').text('(11)');
            $('td:contains("31-32")').text('(10)');
            $('td:contains("26-27")').text('(9)');
            $('td:contains("24-25")').text('(8)');
            $('td:contains("22-23")').text('(7)');
            $('td:contains("20-21")').text('(6)');
            $('td:contains("18-19")').text('(5)');
            $('td:contains("16-17")').text('(4)');
            $('td:contains("14-15")').text('(3)');
            $('td:contains("12-13")').text('(2)');
            $('td:contains("7-8")').text('(1)');

            $('td:contains("24-27")').text('(5)');
            $('td:contains("20-23")').text('(4)');
            $('td:contains("16-19")').text('(3)');
            $('td:contains("12-15")').text('(2)');
            if (type() === 'tioga')
                $('td:contains("5-8")').text('(1)');

            $('td:contains("17-20")').text('(5)');
            $('td:contains("13-16")').text('(4)');
            $('td:contains("9-12")').text('(3)');
            if (type() === 'canon')
                $('td:contains("5-8")').text('(2)');
            $('td:contains("1-4")').text('(1)');

            $('.UnitTag').css('width', '1px');

            if (type() === 'tioga') {
                var tiogaRacks = $('.RackTable:contains(Phoenix_TP_L10 )').children();
                var yosemiteRacks = $('.RackTable:contains(Phoenix_Yosemite)').children();

                var uselessLinesYosemite = ['2', '3', '4', '10', '11', '13',
                                            '14', '15', '16', '17'];
                var uselessLinesTioga = ['2', '3', '4', '5', '6', '7', '10',
                                         '11', '21', '22','25', '26', '27',
                                         '28', '29', '30', '31'];

                $(tiogaRacks).each((index, element)=>{
                    var singleRack = element;
                    for (const x of uselessLinesTioga) {
                        $(singleRack).children(':eq('+x+')').css('display','none');
                    }
                    $(singleRack).children(':eq(12)').children(':nth-child(2)')
                        .css('background', '#333131');
                    $(singleRack).children(':eq(23)').children(':nth-child(2)')
                        .css('background', '#333131');
                });

                $(yosemiteRacks).each((index, element)=>{
                    var singleRack = element;
                    for (const x of uselessLinesYosemite) {
                        $(singleRack).children(':eq('+x+')').css('display','none');
                        $(singleRack).children(':eq(9)').children(':nth-child(2)')
                            .css('background', '#333131');
                    }
                });

                $('.RackTable:contains(RK-'+yosemiteL11RackNum+') '+
                  '.ModelTable:first td:contains(phoenix_yosemite_v2_l10)')
                    .css({'background':'#1c1b1b'}).text('L11');
                $('.RackTable:contains(RK-'+tiogaL11RackNum+') '+
                  '.ModelTable:lt(2) td:contains(tioga_pass)')
                    .css('background','#1c1b1b').text('L11');
                $('.ModelTable td:contains("phoenix_yosemite_v2_l10")')
                    .text('yosemite');
                
            }
            $('.ModelTable td').css('font-size', '13px');

            if (type() === "canon") {
                $('.ModelTable td a:contains("10/")').css({
                    'color':'#f00', 'font-size':'30px',
                    'text-shadow': '2px 2px 2px black'});
                $('.ModelTable td a:contains("110/")').css({
                    'color':'#fff', 'font-size':'14px',
                    'text-shadow': 'none'});
            } else if (type() === "lightning") {
                $('.ModelTable td a:contains("17/")').css({
                    'color':'#f00', 'font-size':'30px'});
                $('.ModelTable td a:contains("71/")').css({
                    'color':'#f00', 'font-size':'30px'});
            }
        }
    }

    function createOnOffBu(text, background, whichOne) {
        var scriptsBu = document.createElement("button");
        scriptsBu.innerHTML = text;
        $(scriptsBu).css({
            'position':'relative','background':background,
            'color':'#ffffff','top':'1px', 'height':'30px',});

        $(scriptsBu).on("click", function() {
            if (whichOne === 'scripts') {
                if (localStorage.getItem('scripts') === 'on') {
                    localStorage.setItem('scripts', 'off');
                } else {
                    localStorage.setItem('scripts', 'on');
                }
            }
            if (whichOne === 'theme') {
                if (localStorage.getItem('theme') === 'on') {
                    localStorage.setItem('theme', 'off');
                } else {
                    localStorage.setItem('theme', 'on');
                }
            }
            window.location.reload(false);
        });
        $('.btn-group.menu').append(scriptsBu);
    }

    function refresh() {
        var dialogPresent= $("#modelDialog").attr("style");
         if (new Date().getTime() - time >= 60000) { /*&&
            (dialogPresent == "display: none;" ||
             dialogPresent == null)) { */
            //primaryScroll();
            updateRacks();
            time = new Date().getTime();
        }
        setTimeout(refresh, 10000);
    }

    function scriptsOn() {
        createKeyboardShortcuts();
        sendGetRackReq("All");
        waitTillLoad(301);
        createPrimaryButton();
        createYosemiteScrollBu();
        $('#refresh').css('display','none'); //TODO

        $(document.body).bind("mousemove keypress", function() {
            time = new Date().getTime();
        });
        refresh();
    }

    function initialRun() {
        if (localStorage.getItem('scripts') === 'on') {
            createOnOffBu('OFF', '#ac0c0c', 'scripts');
            scriptsOn();
        } else {
            createOnOffBu('ON', '#33CC33', 'scripts');
        }
        if (localStorage.getItem('theme') === 'on') {
            createOnOffBu('untheme', '#ac0c0c', 'theme');

            $('body, table, th, .panel, select, .modal-content')
                .css({'background':'black', 'color':'white'});
            $('.well').css('background', 'black');
            $('.panel-heading').css({
                'background':'#333131',
                'color':'white'});
            $('.modal-header').css(
                'background', 'black');
            $('table[width]').css({
                'position':'fixed', 'bottom':'1px',
                'background-color':'transparent'});
            $('th[width]').css({
                'background':'transparent',
                'color':'white',
                'text-shadow':'-2px 0 red, 0 2px red, 2px 0 red, 0 -2px red'});
            $('.Empty').css({'background':'black',
                             'border':'3px white solid'});
            $('.panel-footer').css('display', 'none');
        } else {
            createOnOffBu('theme', '#33CC33', 'theme');
        }
    }

    initialRun();

/*
##############################################################################################
#                                       SCANNING PART                                        #
##############################################################################################
*/

    function initialDialogCheckout() {
        var dialogPresent;
        var dialog = setInterval(()=>{
            dialogPresent = $('#modelDialog').attr('style');
            if(dialogPresent != "display: none;" && dialogPresent != null) {
                if (localStorage.getItem('theme') === 'on') {
                    $('.form-control').css({'background':'black',
                                            'color':'white'});
                    $('.modal-content:eq(1)').css('border', '3px gray solid');
                }
                clearInterval(dialog);

                if (localStorage.getItem('scripts') === 'on') {
                    focusWhere();

                    $('#mainForm input, #mainForm textarea').each((i, element)=>{
                        checkIfDialogInputsFits(element);
                    });

                    $('#mainForm input, #mainForm textarea').on('input', function(){
                        checkIfDialogInputsFits(this);
                    });

                    if (isDialogFirst()) {
                        var obj = {};
                        dialogFunc(obj);
                    }
                }
            }
        }, 200);
    }

    function isDialogFirst() {
        var position = $('#position').val()
        var pos = position.charAt(position.length-1);
        var model = $('#model').text();

        if ((model === 'phoenix_yosemite_v2_l10' && pos === '1') ||
            (model === 'TYPE5_L10' && pos === '1') ||
            model === 'tioga_pass' ||
            (model === 'lightning' &&
             (position === "20" || position === "50" ||
              position === "80"))) {

            return true;
        }
    }

    function focusWhere() {
        if (!$('#11').val()) {
            if (localStorage.getItem("cecko")) {
                $('#11').val(localStorage.getItem("cecko"));
                $('#nodeSn').focus();
            } else {
                $("#11").focus();
            }
        } else {
            $("#nodeSn").focus();
        }
    }

    function tiogaScanningUpOrDownDirection() {
        if (!localStorage.getItem('direction')) {
            if(window.confirm('Skenujes zespodu nahoru?')) {
                localStorage.setItem('direction', 'down2up');
            } else {
                localStorage.setItem('direction', 'up2down');
            }
        }
    }

    function dialogFunc(obj) {
        var model = $('#model').text();

        if ('rack' in obj) {
            if (model === "phoenix_yosemite_v2_l10") {
                pasteLoadedYosemite(obj);
                yosemiteFocus();
            } else if (model === "lightning") {
                pasteLoadedLightning(obj);
                lightningFocus();
            } else if (model === "TYPE5_L10") {
                pasteLoadedCanon(obj);
                canonFocus();
            }
            $('#mainForm input, #mainForm textarea').each((i, element)=>{
                checkIfDialogInputsFits(element);
            });
        } else {
            Object.defineProperty(obj, "model", {
                value: model
            });
            Object.defineProperty(obj, "rack", {
                value: $("#location").val()
            });

            if (model === "tioga_pass") {
                tiogaScanningUpOrDownDirection();
            } else if (model === "phoenix_yosemite_v2_l10") {
                $("#18").focus();
                $('#18, #20, #34, #36').on('input', function(e) {
                    Object.defineProperty(obj, "value"+$(this).attr('id'), {
                        value: $(this).val(),
                        configurable: true
                    });
                });
                yosemiteFocus();
            } else if (model === "lightning") {
                $('#13, #29, #39').on('input', function(e) {
                    Object.defineProperty(obj, "value"+$(this).attr('id'), {
                        value: $(this).val(),
                        configurable: true
                    });
                });
                lightningFocus();
            } else if (model === "TYPE5_L10") {
                $('#13, #29, #30, #39').on('input', function(e) {
                    Object.defineProperty(obj, "value"+$(this).attr('id'), {
                        value: $(this).val(),
                        configurable: true
                    });
                });
            }
        }

        var dialogPresent;
        var dialog = setInterval(()=>{
            dialogPresent= $('#modelDialog').attr('style');
            if(dialogPresent == "display: none;" || dialogPresent == null) {
                clearInterval(dialog);
                primaryScroll();
                return false;
            }
        }, 100);

        $('#mainForm input, #mainForm textarea').on('keypress', function(e) {
            if (e.which == 13) {
                if ($('.wronginput').length && !isSomeInputOfDialogEmpty()) {
                    $('.wronginput')[0].select();
                } else if ($('.wronginput').length === 0 && !isSomeInputOfDialogEmpty()) {
                    clearInterval(dialog);
                    var nextPosition = nextPositionFunc(model);
                    if(nextPosition == null) return;
                    get2AnotherDialog(obj, nextPosition);
                }
            }
        });
    };

    function get2AnotherDialog(obj, nextPosition) {

        function clickAnother() {
            var promise = new Promise((resolve, reject)=> {
                var location = $('.RackTable:contains('+obj.rack+')').find('.'+nextPosition);
                if (location.length) {
                    location[0].click();
                    resolve();
                } else {
                    reject();
                    primaryScroll();
                }
            });
            return promise;
        }
        dialogCheckout()
            .then(submitDialog)
            .then(dialogCheckoutDisappears)
            .then(clickAnother)
            .then(dialogCheckout)
            .then(()=> {
/*          we don't want to run another instance of dialogFunc
            with every scanned tioga, do we? */
            if ($('#model').text() !== 'tioga_pass') dialogFunc(obj);
        });
    }

    function checkIfDialogInputsFits(input) {
        var inputField = input.getAttribute('id');
        var regex = new RegExp;
        switch (inputField) {
            case "11": // Operator ID
                regex = new RegExp(/^C[0-9]{7}$/);
                highlightWrongInputsFunc(input, regex);
                break;
            case "nodeSn": //system sn
                if ($('#model').text() === "tioga_pass") {
                    regex = new RegExp(/^WTH[A-Z0-9]{7}CA1$/);
                    highlightWrongInputsFunc(input, regex);
                } else if ($('#model').text() === "phoenix_yosemite_v2_l10") {
                    regex = new RegExp(/^BZA[A-Z0-9]{9}CA1$/);
                    highlightWrongInputsFunc(input, regex);
                } else if ($('#model').text() === "TYPE5_L10") {
                    regex = new RegExp(/^1PL[0-9]{8}$/);
                    highlightWrongInputsFunc(input, regex);
                }
                else if ($('#model').text() === "lightning") {
                    regex = new RegExp(/^TG[0-9A-Z]{7}ZA1$/);
                    highlightWrongInputsFunc(input, regex);
                }
                break;
            case "13": // system pn
                if ($('#model').text() === "lightning") {
                    regex = new RegExp(/^[0-9]{2}-[0-9]{6}$/);
                    highlightWrongInputsFunc(input, regex);
                }
                else if ($('#model').text() === "tioga_pass") {
                    regex = new RegExp(/^B91\.00X01\.00[0-9]{2}$/);
                    highlightWrongInputsFunc(input, regex);
                }
                else if ($('#model').text() === "phoenix_yosemite_v2_l10") {
                    regex = new RegExp(/^BZA\.01503\.0[0-9]{3}$/);
                    highlightWrongInputsFunc(input, regex);
                }
                else if ($('#model').text() === "TYPE5_L10") {
                    regex = new RegExp(/^B91\.01101\.0[0-9]{3}$/);
                    highlightWrongInputsFunc(input, regex);
                }
                break;
            case "29": //fb asset tag
                regex = new RegExp(/^[0-9]{7}$/);
                highlightWrongInputsFunc(input, regex);

                break;
            case "30": // fb pn
                regex = new RegExp(/^[0-9]{2}-[0-9]{6}$/);
                highlightWrongInputsFunc(input, regex);
                break;
            case "18": // lower tray sn
                regex = new RegExp(/^WTL[0-9A-Z]{7}CA1$/);
                highlightWrongInputsFunc(input, regex);
                break;
            case "20": // lower tray pn  B91.01501.0014
                regex = new RegExp(/^B[0-9]{2}\.[0-9]{5}\.[0-9]{4}$/);
                highlightWrongInputsFunc(input, regex);
                break;
            case "34": // lower tray pn
                regex = new RegExp(/^[0-9]{7}$/);
                highlightWrongInputsFunc(input, regex);
                break;
            case "36": // lower tray pn
                regex = new RegExp(/^[0-9]{2}-[0-9]{6}$/);
                highlightWrongInputsFunc(input, regex);
                break;

            case "17": // Upper Tray SN
                regex = new RegExp(/^BZ[0-9A-Z]+NA1$/);
                highlightWrongInputsFunc(input, regex);
                break;
            case "33": // Upper Tray Asset Tag
                regex = new RegExp(/^[0-9]{7}$/);
                highlightWrongInputsFunc(input, regex);
                break;
            case "35": // Upper Tray FB PN
                regex = new RegExp(/^[0-9]{2}-[0-9]{6}$/);
                highlightWrongInputsFunc(input, regex);
                break;
            case "39": // Chassis SN
                regex = new RegExp(/^WT[0-9A-Z]{8}CA1$/);
                highlightWrongInputsFunc(input, regex);
                break;

            case "32": // Ether MAC Address
                regex = new RegExp(/^[0-9A-Z]{12}$/);
                highlightWrongInputsFunc(input, regex);
                break;
            case "1": // Rack SN
                break;
            default:
                console.log($(input));
                console.log('WTF?');
                break;
        }
    }

    function highlightWrongInputsFunc(input, regex) {
        if (!regex.test($(input).val())) {
            $(input).css({'background':'red',
                         'color':'white'});
            $(input).addClass('wronginput');
        } else {
            $(input).css({'background':'unset',
                        'color':'unset'});
            $(input).removeClass('wronginput');
        }
    }

    function getNextTioga() {
        var positions = [];
        if(localStorage.getItem('direction') == 'down2up') {
            positions = ["33", "31", "26", "24", "22", "20", "18", "16", "14", "12", "7"];
        } else {
            positions = ["7", "12", "14", "16", "18", "20", "22", "24", "26", "31", "33"];
        }
        var position = $("#position").val(); // etc. 121
        var nextPosition = "";
        if (position.charAt(position.length-1) == "3") {
            var a = position.charAt(position.length - 3) +
                position.charAt(position.length - 2);
            nextPosition = positions[positions.indexOf(a)-1] + "11";
        } else if (position != "3") {
            nextPosition = position.charAt(position.length-3) +
                position.charAt(position.length-2) + "1" +
                (parseInt(position.charAt(position.length-1))+1).toString();

        } else {
            return null;
        }
        return nextPosition;
    }

    function nextPositionFunc(model) {
        var nextPosition = '';
        if (model === "tioga_pass") {
            nextPosition = getNextTioga();
        } else if (model === "phoenix_yosemite_v2_l10") {
            nextPosition = yosemiteNextPosition();
        } else if (model === "lightning") {
            nextPosition = $("#position").val();
            nextPosition = nextPosition * 10 + 111;
            return nextPosition;
        }
        return nextPosition;
    }

    function yosemiteFocus() {
        $("#20").on("keypress", function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                $("#34").focus();
            }
        });
        $("#36").on("keypress", function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                $("#nodeSn").focus();
            }
        });
        $("#13").on("keypress", function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                $("#30").focus();
            }
        });

    }

    function yosemiteNextPosition() {
        var position = $("#position").val();
        if (position.length == 4) {
            // the class name of td is different than the class name of a position in the dialog
            position = position.charAt(0) + position.charAt(1)
                + position.charAt(3) + position.charAt(2);
        } else {
            position = position.charAt(0) + position.charAt(2)
                + position.charAt(1);
        }
        position = (parseInt(position)+10).toString();
        return position;
    }

    function pasteLoadedYosemite(obj) {
        $('#18').val(obj.value18);
        $('#20').val(obj.value20);
        $('#34').val(obj.value34);
        $('#36').val(obj.value36);
        //TODO
    }

    function pasteLoadedCanon(obj) {
        $('#13').val(obj.value13);
        $('#29').val(obj.value29);
        $('#30').val(obj.value30);
        $('#39').val(obj.value39);
    }

    function canonFocus() {
        $("#nodeSn").on("keypress", function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                $("#32").focus();
            }
        });
    }

    function lightningFocus() {
        $("#nodeSn").on("keydown", function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                $('#17').focus();
            }
        });

        $("#17").on("keypress", function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                $('#33').focus();
            }
        });

        $("#39").on("keypress", function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                $('#13').focus()
            }
        });

        $("#13").on("keypress", function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                $('#29').focus();
            }
        });
    }

    function pasteLoadedLightning(obj) {
        $('#13').val(obj.value13);
        $('#29').val(obj.value29);
        $('#39').val(obj.value39);
    }

    var submitDialog = function() {
        var promise = new Promise((resolve, reject)=> {
            if (/^C[0-9]{7}$/.test($('#11').val())) {
                localStorage.setItem("cecko", $('#11').val());
            }
            var submitButton = $(".btn.btn-primary.btn-sm.submitScanIn");
            if(submitButton) {
                submitButton.click();
                resolve();
            } else reject();
        });
        return promise;
    }

    function isSomeInputOfDialogEmpty(){
        var isSomeInputEmpty = false;
        $('#mainForm input').each((i, element)=> {
            if ($(element).val() == '') {
                isSomeInputEmpty=true;
            }
        });
        return isSomeInputEmpty;
    }

    var dialogCheckout = function() {
        var promise = new Promise((resolve)=> {
            var dialogPresent;
            var dialog = setInterval(()=>{
                dialogPresent = $("#modelDialog").attr("style");
                if(dialogPresent != "display: none;" && dialogPresent != null) {
                    clearInterval(dialog);
                    resolve();
                }
            }, 100);
        });
        return promise;
    }

    var dialogCheckoutDisappears = function() {
        var promise = new Promise((resolve)=> {
            var dialogPresent;
            var dialog = setInterval(()=>{
                dialogPresent= $("#modelDialog").attr("style");
                if(dialogPresent == "display: none;" || dialogPresent == null) {
                    clearInterval(dialog);
                    resolve();
                }
            }, 100);
        });
        return promise;
    }

    function modelNumFromSN(node_sn) {
        let regexTiogaSN = new RegExp(/^WTH[A-Z0-9]{7}CA1$/);
        let regexYosemiteSN = new RegExp(/^BZA[A-Z0-9]{9}CA1$/);
        let regexCanonSN = new RegExp(/^1PL[0-9]{8}$/);
        let regexLightningSN = new RegExp(/^TG[0-9A-Z]{7}ZA1$/);
        let regexLeopardSN = new RegExp(/^WTF[0-9A-Z]{7}[ZC]A1$/);

        let modelNum = 0;

        if (regexTiogaSN.test(node_sn)) modelNum = "4";
        else if (regexYosemiteSN.test(node_sn)) modelNum = "5";
        else if (regexCanonSN.test(node_sn)) modelNum = "4";
        else if (regexLightningSN.test(node_sn)) modelNum = "4";
        else if (regexLeopardSN.test(node_sn)) modelNum = "1";

        return modelNum;
    }

})();