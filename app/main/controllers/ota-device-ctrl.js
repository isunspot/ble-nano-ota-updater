'use strict';

angular
    .module('main')
    .controller('OtaDeviceCtrl', function($cordovaBluetoothLE, $stateParams, $log, $timeout, $q, Constants) {

        var vm = this;

        vm.device = $stateParams.device;
        vm.connected = false;

        var subscriptions = {};
        var firmwareFileUri = 'content://com.android.providers.downloads.documents/document/16535';

        var createTimeout = function( params, q ) {

            if( params.timeout ) {
                return $timeout( function() {
                    params.error = 'timeout';
                    q.reject( params );
                }, params.timeout );
            }

            return null;
        };

        var close = function( params ) {

            var q = $q.defer();

            window.bluetoothle.close(
                function( obj ) {
                    $log.log( 'Close Success: ' + JSON.stringify( obj ) );
                    vm.connected = false;

                    q.resolve( obj );
                },
                function( obj ) {
                    $log.log( 'Close Error: ' + JSON.stringify( obj ) );

                    q.reject( obj );
                },
                params
            );

            return q.promise;
        };

        var connect = function( params ) {

            var q = $q.defer();

            var timeout = createTimeout( params, q );

            window.bluetoothle.connect(
                function( obj ) {
                    $log.log( 'Connect Success: ' + JSON.stringify( obj ) );

                    $timeout.cancel(timeout);
                    vm.connected = true;

                    if( obj.status === 'disconnected' ) {
                        close( { address: obj.address } );
                    }

                    if(params.useResolve) {
                        q.resolve( obj );
                    } else {
                        q.notify( obj );
                    }
                },
                function( obj ) {
                    $log.log( 'Connect Error: ' + JSON.stringify( obj ) );

                    $timeout.cancel( timeout );
                    q.reject( obj );
                },
                params
            );

            return q.promise;
        };

        var discover = function( params ) {

            var q = $q.defer();
            var timeout = createTimeout( params, q );

            window.bluetoothle.discover(
                function( obj ) {
                    $log.log( 'Discover Success: ' + JSON.stringify( obj ) );

                    $timeout.cancel( timeout );
                    q.resolve( obj );
                },
                function( obj ) {
                    $log.log( 'Discover Error: ' + JSON.stringify( obj ) );

                    $timeout.cancel( timeout );
                    q.reject( obj );
                },
                params
            );

            return q.promise;
        };

        /*
        var read = function( params ) {

            var q = $q.defer();

            var timeout = createTimeout( params, q );

            window.bluetoothle.read(
                function( obj ) {
                    $log.log( 'Read Success: ' + JSON.stringify( obj ) );

                    $timeout.cancel( timeout );
                    q.resolve( obj );
                },
                function( obj ) {
                    $log.log( 'Read Error: ' + JSON.stringify( obj ) );

                    $timeout.cancel( timeout );
                    q.reject( obj );
                },
                params
            );

            return q.promise;
        };
        */

        var write = function( params ) {

            var q = $q.defer();

            var timeout = createTimeout( params, q );

            window.bluetoothle.write(
                function( obj ) {
                    $log.log( 'Write Success: ' + JSON.stringify( obj ) );

                    $timeout.cancel( timeout );
                    q.resolve( obj );
                },
                function( obj ) {
                    $log.log( 'Write Error: ' + JSON.stringify( obj ) );

                    $timeout.cancel( timeout );
                    q.reject( obj );
                },
                params
            );

            return q.promise;
        };

        var subscribe = function( params ) {

            var q = $q.defer();

            var timeout = createTimeout( params, q );

            window.bluetoothle.subscribe(
                function( obj ) {
                    $log.log( 'Subscribe Success: ' + JSON.stringify( obj ) );

                    if( obj.status === 'subscribedResult' ) {
                        subscriptions[ obj.characteristic ] = window.bluetoothle.encodedStringToBytes( obj.value );
                        $log.log( 'Decoded result: ' + JSON.stringify( subscriptions[ obj.characteristic ] ) );
                    }

                    $timeout.cancel( timeout );
                    q.resolve( obj );
                },
                function( obj ) {
                    $log.log( 'Subscribe Error: ' + JSON.stringify( obj ) );

                    $timeout.cancel( timeout );
                    q.reject( obj );
                },
                params
            );

            return q.promise;
        };

        var waitForNotification = function( characteristic, callback ) {

            if( subscriptions[ characteristic ] === null ) {
                setTimeout( function() {
                    waitForNotification( characteristic, callback );
                }, 100 );
            } else {
                callback();
            }
        };

        var writeOpCode = function( characteristic, value ) {

            var params = {
                address: vm.device.address,
                service: Constants.DFU_SERVICE_UUID,
                characteristic: characteristic,
                value: $cordovaBluetoothLE.bytesToEncodedString( value )
            };

            subscriptions[ characteristic ] = null;

            return write( params )
                .then( function() {

                    return $q( function( resolve ) {
                        waitForNotification( characteristic, resolve );
                    } );
                } );
        };

        var formatFirmwareImageSize = function( size ) {

            var buf = new ArrayBuffer( 12 );
            var view = new DataView( buf );

            view.setUint32( 8, size, true );

            return new Uint8Array( buf );
        };

        vm.discoverDevice = function() {

            var params = {
                address: vm.device.address
            };

            return discover( params )
                .then( function( data ) {
                    $log.log( data );
                } );
        };

        vm.connectToDevice = function() {

            var params = {
                address: vm.device.address,
                useResolve: true
            };

            return connect( params )
                .then( function( data ) {
                    $log.log( data );
                } );
        };

        vm.uploadFirmware = function() {

            $log.log( 'Starting OTA update' );

            $log.log( 'Discovering device' );
            return vm.discoverDevice()
                .then( function() {

                    $log.log( 'Subscribing for notifications' );

                    var params = {
                        address: vm.device.address,
                        service: Constants.DFU_SERVICE_UUID,
                        characteristic: Constants.DFU_CONTROL_POINT_UUID
                    };

                    return subscribe( params );
                } )
                .then( function() {

                    $log.log( 'Sending Start DFU command' );
                    return writeOpCode( Constants.DFU_CONTROL_POINT_UUID, Constants.OP_CODE_START_DFU );
                } )
                .then( function() {

                    return $q( function( resolve, reject ) {

                        window.FilePath.resolveNativePath( firmwareFileUri,
                            function( filePath ) {

                                window.resolveLocalFileSystemURL( filePath,
                                    function( fileEntry ) {

                                        $log.log( 'Resolved firmware file path: ' + fileEntry.fullPath );

                                        fileEntry.file(
                                            function( file ) {

                                                $log.log( 'Firmware file size: ' + file.size );

                                                var reader = new FileReader();

                                                reader.onloadend = function( evt ) {
                                                    $log.log( JSON.stringify( evt ) );
                                                    resolve();
                                                };

                                                reader.readAsArrayBuffer( file );
                                            },
                                            reject
                                        );
                                    },
                                    reject
                                );
                            },
                            reject
                        );
                    } );
                } )
                .catch( function( err ) {
                    $log.error( 'Update failed: ' + JSON.stringify( err ) );
                } );
        };

        vm.selectFirmwareFile = function() {
            window.fileChooser.open(
                function( uri ) {
                    firmwareFileUri = uri;
                },
                function( err ) {
                    $log.error( 'Failed to select firmware file: ' + JSON.stringify( err ) );
                }
            );
        };
    } );
