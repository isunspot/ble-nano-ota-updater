'use strict';

angular
    .module('main')
    .controller('OtaCtrl', function($cordovaBluetoothLE, $log) {

        var vm = this;
        vm.devices = {};

        vm.initialize = function() {

            var params = {
                request: true
            };

            $log.log('Initialize : ' + JSON.stringify(params));

            $cordovaBluetoothLE.initialize(params).then(null, function(obj) {
                $log.log('Initialize Error : ' + JSON.stringify(obj)); //Should only happen when testing in browser
            }, function(obj) {
                $log.log('Initialize Success : ' + JSON.stringify(obj));
            });
        };

        vm.startScan = function() {

            var params = {
                services: [],
                allowDuplicates: false //,
                //scanTimeout: 15000,
            };

            if( window.cordova ) {
                params.scanMode = window.bluetoothle.SCAN_MODE_LOW_POWER;
                params.matchMode = window.bluetoothle.MATCH_MODE_STICKY;
                params.matchNum = window.bluetoothle.MATCH_NUM_ONE_ADVERTISEMENT;
                // params.callbackType = window.bluetoothle.CALLBACK_TYPE_FIRST_MATCH;
            }

            $log.log('Start Scan : ' + JSON.stringify(params));

            $cordovaBluetoothLE.startScan(params).then(function(obj) {
                $log.log('Start Scan Auto Stop : ' + JSON.stringify(obj));
            }, function(obj) {
                $log.log('Start Scan Error : ' + JSON.stringify(obj));
            }, function(obj) {
                $log.log('Start Scan Success : ' + JSON.stringify(obj));

                addDevice(obj);
            });
        };

        vm.stopScan = function() {
            $log.log('Stop Scan');

            $cordovaBluetoothLE.stopScan().then(function(obj) {
                $log.log('Stop Scan Success : ' + JSON.stringify(obj));
            }, function(obj) {
                $log.log('Stop Scan Error : ' + JSON.stringify(obj));
            });
        };

        function addDevice(obj) {
            $log.log(1);
            if( obj.status === 'scanStarted' ) {
                return;
            }

            $log.log(2);
            /*
            if( vm.devices[obj.address] !== undefined ) {
                return;
            }
            */

            $log.log(3);
            obj.services = {};
            vm.devices[obj.address] = obj;

            $log.log(vm.devices);
        }

        vm.initialize();
    });