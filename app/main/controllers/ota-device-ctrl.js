'use strict';

angular
    .module( 'main' )
    .controller( 'OtaDeviceCtrl', function( $cordovaBluetoothLE, $log, $scope, $stateParams, $timeout ) {

        var vm = this;

        var BLENanoOTAUpdater = window.BLENanoOTAUpdater;

        vm.device = $stateParams.device;
        vm.connected = false;
        vm.stateMessage = 'Press Update Button';

        // var firmwareFileUri = 'content://com.android.providers.downloads.documents/document/16535';
        vm.firmwareFileBuf = null;

        function chooseLocalFile() {

            return new Promise( function( resolve, reject ) {

                window.fileChooser.open(
                    function( uri ) {
                        resolve( uri );
                    },
                    function( err ) {
                        $log.error( 'Failed to select firmware file: ' + JSON.stringify( err ) );
                        reject( err );
                    }
                );
            } );
        }

        function readFirmwareFile( firmwareFileUri ) {

            return new Promise( function( resolve, reject ) {

                window.FilePath.resolveNativePath( firmwareFileUri,
                    function( filePath ) {

                        window.resolveLocalFileSystemURL( filePath,
                            function( fileEntry ) {

                                fileEntry.file(
                                    function( file ) {

                                        var reader = new FileReader();

                                        reader.onloadend = function( evt ) {
                                            resolve( new Uint8Array( evt.target.result ) );
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
        }

        function updateStateMessage( message ) {
            $timeout( function() {
                vm.stateMessage = message;
            } );
        }

        vm.uploadFirmware = function() {

            var updater = new BLENanoOTAUpdater( vm.device, { logLevel: BLENanoOTAUpdater.LOG_LEVEL_DEBUG } );

            updater
                .on( BLENanoOTAUpdater.EVENT_UPLOAD_PROGRESS, function( payload ) {
                    $log.debug( payload.progress + '%' );
                    updateStateMessage( 'Uploading image: ' + payload.progress + '%' );
                } )
                .on( BLENanoOTAUpdater.EVENT_UPDATE_STATE_CHANGE, function( payload ) {

                    switch( payload.state ) {
                        case BLENanoOTAUpdater.STATE_CHECKING_PRECONDITIONS:
                            updateStateMessage( 'Checking preconditions' );
                            break;

                        case BLENanoOTAUpdater.STATE_CONNECTING_TO_DEVICE:
                            updateStateMessage( 'Connecting to device' );
                            break;

                        case BLENanoOTAUpdater.STATE_DISCOVERING_SERVICES:
                            updateStateMessage( 'Discovering services' );
                            break;

                        case BLENanoOTAUpdater.STATE_SUBSCRIBING_FOR_NOTIFICATIONS:
                            updateStateMessage( 'Subscribing for notifications' );
                            break;

                        case BLENanoOTAUpdater.STATE_STARTING_DFU:
                            updateStateMessage( 'Starting DFU' );
                            break;

                        case BLENanoOTAUpdater.STATE_INITIALIZING_IMAGE_UPLOAD:
                            updateStateMessage( 'Initializing image upload' );
                            break;

                        case BLENanoOTAUpdater.STATE_UPLOADING_IMAGE:
                            updateStateMessage( 'Uploading image: 0%' );
                            break;

                        case BLENanoOTAUpdater.STATE_VALIDATING_UPLOADED_IMAGE:
                            updateStateMessage( 'Validating uploaded image' );
                            break;

                        case BLENanoOTAUpdater.STATE_RESTARTING_DEVICE:
                            updateStateMessage( 'Restarting device' );
                            break;

                        case BLENanoOTAUpdater.STATE_UNSUBSCRIBING_FOR_NOTIFICATIONS:
                            updateStateMessage( 'Canceling subscription for notifications' );
                            break;

                        case BLENanoOTAUpdater.STATE_CLOSING_DEVICE_CONNECTION:
                            updateStateMessage( 'Done!' );
                            break;
                        default:
                            $log.debug( 'Unknown state: ' + payload.state );
                    }
                } )
                .on( BLENanoOTAUpdater.EVENT_ERROR, function( err ) {
                    $log.error( 'Failed to upload firmware: ' + JSON.stringify( err ) );
                    updateStateMessage( 'Sorry, error occurred' );
                } );

            updater.uploadFirmware( vm.firmwareFileBuf );
        };

        vm.selectFirmwareFile = function() {

            return chooseLocalFile()
                .then( function( fileUri ) {

                    return readFirmwareFile( fileUri )
                        .then( function( fileBuf ) {
                            $timeout( function() {
                                vm.firmwareFileBuf = fileBuf;
                            } );
                        } );
                } )
                .catch( function( err ) {
                    $log.error( 'Failed to load firmware file: ' + JSON.stringify( err ) );
                } );
        };
    } );
