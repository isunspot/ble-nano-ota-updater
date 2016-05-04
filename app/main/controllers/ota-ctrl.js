'use strict';

angular
    .module( 'main' )
    .controller( 'OtaCtrl', function( $cordovaBluetoothLE, $stateParams, $log ) {

        var vm = this;
        vm.isScanning = false;
        // vm.devices = {};

        vm.devices = {
            'EC:E7:5E:FD:A9:66': {
                address: 'EC:E7:5E:FD:A9:66',
                name: 'Test Device'
            }
        };

        function addDevice( obj ) {

            if( obj.status === 'scanStarted' ) {
                return;
            }

            /*
             if( vm.devices[obj.address] !== undefined ) {
             return;
             }
             */

            obj.services = {};
            vm.devices[ obj.address ] = obj;

            $log.log( vm.devices );
        }

        function initialize() {

            var params = {
                request: true
            };

            $log.log( 'Initialize : ' + JSON.stringify( params ) );

            $cordovaBluetoothLE.initialize( params ).then( null, function( obj ) {
                $log.log( 'Initialize Error : ' + JSON.stringify( obj ) ); // Should only happen when testing in browser
            }, function( obj ) {
                $log.log( 'Initialize Success : ' + JSON.stringify( obj ) );
            } );
        }

        function startScan() {

            vm.devices = {};

            var params = {
                services: [],
                allowDuplicates: false,
                scanTimeout: 10000
            };

            /* These flags are supported from Android API21/23 only
            if( window.cordova ) {
                params.scanMode = window.bluetoothle.SCAN_MODE_LOW_POWER;
                params.matchMode = window.bluetoothle.MATCH_MODE_STICKY;
                params.matchNum = window.bluetoothle.MATCH_NUM_ONE_ADVERTISEMENT;
                // params.callbackType = window.bluetoothle.CALLBACK_TYPE_FIRST_MATCH;
            }
            */

            $log.log( 'Start Scan : ' + JSON.stringify( params ) );

            $cordovaBluetoothLE.startScan( params ).then( function( obj ) {
                $log.log( 'Start scan Auto Stop : ' + JSON.stringify( obj ) );
            }, function( obj ) {
                $log.error( 'Start scan Error : ' + JSON.stringify( obj ) );
            }, function( obj ) {
                $log.log( 'Start scan Success : ' + JSON.stringify( obj ) );

                addDevice( obj );
            } );
        }

        function stopScan() {
            $log.log( 'Stop scan' );

            $cordovaBluetoothLE.stopScan().then( function( obj ) {
                $log.log( 'Stop scan Success : ' + JSON.stringify( obj ) );
            }, function( obj ) {
                $log.error( 'Stop scan Error : ' + JSON.stringify( obj ) );
            } );
        }

        vm.startStopScanning = function() {

            if( vm.isScanning ) {
                stopScan();
            } else {
                vm.devices = {};
                startScan();
            }

            vm.isScanning = !vm.isScanning;
        };

        document.addEventListener( 'deviceready', initialize, false );
    } );
