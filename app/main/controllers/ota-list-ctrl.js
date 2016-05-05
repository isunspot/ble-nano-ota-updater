'use strict';

angular
    .module( 'main' )
    .controller( 'OtaListCtrl', function( $cordovaBluetoothLE, $stateParams, $log ) {

        var vm = this;
        vm.isScanning = false;
        vm.devices = {};

        // This algorithm is not perfect and is based on experimental data
        function resolveDeviceName( device ) {

            if( device.name === null ) {
                return;
            }

            var advertisementStr = $cordovaBluetoothLE.bytesToString( $cordovaBluetoothLE.encodedStringToBytes( device.advertisement ) );
            var advertisementArr = advertisementStr.split( '\t' );

            var name = advertisementArr.pop();

            var match = name.match( /([-_a-zA-Z0-9 ])+/ );
            if( match ) {
                device.name = match[ 0 ];
            }
        }

        function addDevice( obj ) {

            if( obj.status === 'scanStarted' ) {
                return;
            }

            resolveDeviceName( obj );

            obj.services = {};
            vm.devices[ obj.address ] = obj;

            $log.log( vm.devices );
        }

        function startScan() {

            vm.devices = {};
            vm.isScanning = true;

            var params = {
                services: [],
                allowDuplicates: false,
                scanTimeout: 10000
            };

            $log.debug( 'Start scan : ' + JSON.stringify( params ) );

            $cordovaBluetoothLE.startScan( params ).then( function( obj ) {
                $log.debug( 'Start scan auto stop : ' + JSON.stringify( obj ) );
                vm.isScanning = !vm.isScanning;
            }, function( obj ) {
                $log.error( 'Start scan error : ' + JSON.stringify( obj ) );
            }, function( obj ) {
                $log.debug( 'Start scan success : ' + JSON.stringify( obj ) );

                addDevice( obj );
            } );
        }

        function stopScan() {

            vm.isScanning = false;

            $cordovaBluetoothLE.stopScan().then( function( obj ) {
                $log.debug( 'Stop scan success : ' + JSON.stringify( obj ) );
            }, function( obj ) {
                $log.error( 'Stop scan error : ' + JSON.stringify( obj ) );
            } );
        }

        function isAndroid23OrNewer() {
            return device.platform === 'Android' && device.version >= '6.0';
        }

        function initialize() {

            var params = {
                request: true
            };

            $log.debug( 'Initialize : ' + JSON.stringify( params ) );

            return $cordovaBluetoothLE.initialize( params )
                .then(
                    null,
                    function( obj ) {
                        $log.error( 'Initialize error : ' + JSON.stringify( obj ) ); // Should only happen when testing in browser
                    },
                    function( obj ) {
                        $log.debug( 'Initialize success : ' + JSON.stringify( obj ) );

                        if( !isAndroid23OrNewer() ) {
                            return startScan();
                        }

                        return $cordovaBluetoothLE.hasPermission()
                            .then( function( hasPermissionResult ) {

                                if( hasPermissionResult.hasPermission ) {
                                    return true;
                                }

                                return $cordovaBluetoothLE.requestPermission()
                                    .then( function( requestPermissionResult ) {
                                        return requestPermissionResult.requestPermission;
                                    } );
                            } )
                            .then( function( hasPermission ) {

                                if( !hasPermission ) {
                                    return Promise.resolve();
                                }

                                return $cordovaBluetoothLE.isLocationEnabled()
                                    .then( function( isLocationEnabledResult ) {

                                        if( isLocationEnabledResult.isLocationEnabled ) {
                                            return Promise.resolve();
                                        }

                                        return $cordovaBluetoothLE.requestLocation();
                                    } );
                            } )
                            .then( startScan )
                            .catch( function( err ) {
                                $log.error( 'Permissions error: ' + JSON.stringify( err ) );
                                startScan();
                            } );
                    }
                );
        }

        vm.startStopScanning = function() {

            if( vm.isScanning ) {
                stopScan();
            } else {
                startScan();
            }
        };

        document.addEventListener( 'deviceready', initialize, false );
    } );
