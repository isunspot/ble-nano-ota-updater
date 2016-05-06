'use strict';

angular
    .module( 'main' )
    .controller( 'OtaDeviceCtrl', function( $cordovaBluetoothLE, $cordovaFileTransfer, $log, $scope, $stateParams, $timeout ) {

        var vm = this;

        var BLENanoOTAUpdater = window.BLENanoOTAUpdater;

        vm.device = $stateParams.device;
        vm.stateMessage = 'Press Update Button';
        vm.isUpdating = false;

        vm.firmwareUrl = '';

        function updateStateMessage( message ) {
            $timeout( function() {
                vm.stateMessage = message;
            } );
        }

        function setIsUpdating( isUpdating ) {
            $timeout( function() {
                vm.isUpdating = isUpdating;
            } );
        }

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

        function downloadFirmwareFile( url ) {

            return new Promise(
                function( resolve ) {

                    window.requestFileSystem( window.TEMPORARY, 1024 * 1024, function( fs ) {
                        fs.root.getFile( 'tmp-firmware.hex', { create: true, exclusive: false }, resolve );
                    } );
                } )
                .then( function( fileEntry ) {

                    return $cordovaFileTransfer.download( url, fileEntry.toURL(), {}, true )
                        .then( function() {
                            return fileEntry;
                        },
                        function( err ) {
                            return Promise.reject( err );
                        },
                        function( progress ) {
                            var progressPercent = Math.floor( ( progress.loaded / progress.total ) * 100 );
                            updateStateMessage( 'Download progress: ' + progressPercent + '%' );
                        } );
                } );
        }

        function readFirmwareFile( firmwareFileEntry ) {

            return new Promise( function( resolve, reject ) {

                firmwareFileEntry.file(
                    function( file ) {

                        var reader = new FileReader();

                        reader.onloadend = function( evt ) {
                            resolve( new Uint8Array( evt.target.result ) );
                        };

                        reader.readAsArrayBuffer( file );
                    },
                    reject
                );
            } );
        }

        function updateFirmware( firmwareFileBuf ) {

            var updater = new BLENanoOTAUpdater( vm.device, { logLevel: BLENanoOTAUpdater.LOG_LEVEL_INFO } );

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
                } );

            return updater.uploadFirmware( firmwareFileBuf );
        }

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

        vm.performUpdate = function() {

            setIsUpdating( true );

            updateStateMessage( 'Downloading firmware file' );
            downloadFirmwareFile( vm.firmwareUrl )
                .then( readFirmwareFile )
                .then( updateFirmware )
                .then( function() {
                    setIsUpdating( false );
                } )
                .catch( function( err ) {
                    $log.error( 'Update failed: ' + err );
                    updateStateMessage( 'Sorry, error occurred' );
                    setIsUpdating( false );
                } );
        };
    } );
