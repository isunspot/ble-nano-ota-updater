'use strict';

angular
    .module('main')
    .controller('OtaDeviceCtrl', function($cordovaBluetoothLE, $stateParams, $log, $timeout, $q, Constants) {

        function HexFileInputStream( fileBuf ) {

            var LINE_LENGTH = 128;

            this.fileBuf = fileBuf;
            this.pos = 0;
            this.available = this.calculateImageSize();
            this.localBuf = new Array( LINE_LENGTH );
            this.localPos = LINE_LENGTH;    // we are at the end of the local buffer, new one must be obtained
            this.lastAddress = 0;
            this.size = this.localBuf.length;

            this.reset();
        }

        HexFileInputStream.prototype.reset = function() {
            this.pos = 0;
            this.bytesRead = 0;
            this.localPos = 0;
        };

        HexFileInputStream.prototype.checkComma = function( symbol ) {

            if( symbol !== 0x3A ) {    // ':'
                throw new Error( 'Invalid HEX file' );
            }
        };

        HexFileInputStream.prototype.read = function() {
            return this.fileBuf[ this.pos++ ];
        };

        HexFileInputStream.prototype.readByte = function() {

            var first = parseInt( String.fromCharCode( this.read() ), 16 );
            var second = parseInt( String.fromCharCode( this.read() ), 16 );

            return first << 4 | second;
        };

        HexFileInputStream.prototype.readAddress = function() {
            return this.readByte() << 8 | this.readByte();
        };

        HexFileInputStream.prototype.skip = function( count ) {
            this.pos += count;
        };

        HexFileInputStream.prototype.calculateImageSize = function() {

            this.reset();

            var binSize = 0;

            var b, lineSize, offset, type;
            var lastBaseAddress = 0; // last Base Address, default 0
            var lastAddress;

            b = this.read();

            while ( true ) {    // eslint-disable-line no-constant-condition

                this.checkComma( b );

                lineSize = this.readByte(); // reading the length of the data in this line
                offset = this.readAddress();// reading the offset
                type = this.readByte(); // reading the line type

                switch ( type ) {
                    case 0x01:
                        // end of file
                        return binSize;
                    case 0x04:
                        // extended linear address record
                        /*
                         * The HEX file may contain jump to different addresses. The MSB of LBA (Linear Base Address) is given using the line type 4.
                         * We only support files where bytes are located together, no jumps are allowed. Therefore the newULBA may be only lastULBA + 1 (or any, if this is the first line of the HEX)
                         */
                        var newULBA = this.readAddress();

                        if( binSize > 0 && newULBA !== (lastBaseAddress >> 16) + 1 ) {
                            return binSize;
                        }

                        lastBaseAddress = newULBA << 16;
                        this.skip( 2 ); // skip check sum
                        break;
                    case 0x02:
                        // extended segment address record
                        var newSBA = this.readAddress() << 4;

                        if( binSize > 0 && (newSBA >> 16) !== (lastBaseAddress >> 16) + 1 ) {
                            return binSize;
                        }

                        lastBaseAddress = newSBA;
                        this.skip( 2 ); // skip check sum
                        break;
                    case 0x00:
                        // data type line
                        lastAddress = lastBaseAddress + offset;
                        if( lastAddress >= 0x1000 ) { // we must skip all data from below last MBR address (default 0x1000) as those are the MBR. The Soft Device starts at the end of MBR (0x1000), the app and bootloader farther more
                            binSize += lineSize;
                        }
                    // no break!
                    default:    // eslint-disable-line no-fallthrough
                        this.skip(lineSize * 2 /* 2 hex per one byte */ + 2 /* check sum */);
                        break;
                }

                // skip end of line
                while ( true ) {    // eslint-disable-line no-constant-condition

                    b = this.read();

                    if( b !== 0x0A && b !== 0x0D ) {
                        break;
                    }
                }
            }
        };

        HexFileInputStream.prototype.readLine = function() {

            // end of file reached
            if( this.pos === -1 ) {
                return 0;
            }

            // temporary value
            var b;
            var lineSize, type, offset;
            var address;

            do {
                // skip end of line
                while ( true ) {    // eslint-disable-line no-constant-condition
                    b = this.read();

                    if( b !== 0x0A && b !== 0x0D ) {
                        break;
                    }
                }

                /*
                 * Each line starts with comma (':')
                 * Data is written in HEX, so each 2 ASCII letters give one byte.
                 * After the comma there is one byte (2 HEX signs) with line length (normally 10 -> 0x10 -> 16 bytes -> 32 HEX characters)
                 * After that there is a 4 byte of an address. This part may be skipped.
                 * There is a packet type after the address (1 byte = 2 HEX characters). 00 is the valid data. Other values can be skipped when
                 * converting to BIN file.
                 * Then goes n bytes of data followed by 1 byte (2 HEX chars) of checksum, which is also skipped in BIN file.
                 */
                this.checkComma( b ); // checking the comma at the beginning
                lineSize = this.readByte(); // reading the length of the data in this line
                offset = this.readAddress();// reading the offset
                type = this.readByte(); // reading the line type

                // if the line type is no longer data type (0x00), we've reached the end of the file
                switch ( type ) {
                    case 0x00:
                        // data type
                        if( this.lastAddress + offset < 0x1000 ) { // skip MBR
                            type = -1; // some other than 0
                            this.skip( lineSize * 2 /* 2 hex per one byte */ + 2 /* check sum */ );
                        }
                        break;
                    case 0x01:
                        // end of file
                        this.pos = -1;
                        return 0;
                    case 0x02:
                        // extended segment address
                        address = this.readAddress() << 4;

                        if( this.bytesRead > 0 && (address >> 16) !== (this.lastAddress >> 16) + 1 ) {
                            return 0;
                        }

                        this.lastAddress = address;
                        this.skip( 2 /* check sum */ );
                        break;
                    case 0x04:
                        // extended linear address
                        address = this.readAddress();

                        if( this.bytesRead > 0 && address !== (this.lastAddress >> 16) + 1 ) {
                            return 0;
                        }

                        this.lastAddress = address << 16;
                        this.skip( 2 /* check sum */ );
                        break;
                    default:
                        this.skip( lineSize * 2 /* 2 hex per one byte */ + 2 /* check sum */ );
                        break;
                }
            } while ( type !== 0 );

            // otherwise read lineSize bytes or fill the whole buffer
            for ( var i = 0; i < this.localBuf.length && i < lineSize; ++i ) {
                b = this.readByte();
                this.localBuf[ i ] = b;
            }

            this.skip( 2 ); // skip the checksum
            this.localPos = 0;

            return lineSize;
        };

        HexFileInputStream.prototype.readPacket = function( buf ) {

            var i = 0;

            while ( i < buf.length ) {
                if( this.localPos < this.size ) {
                    buf[ i++ ] = this.localBuf[ this.localPos++ ];
                    continue;
                }

                this.bytesRead += this.size = this.readLine();
                if( this.size === 0 ) {
                    break; // end of file reached
                }
            }

            return i;
        };

        // ---------------------------------------------------------------------

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

        var write = function( params, noLog ) {

            var q = $q.defer();

            var timeout = createTimeout( params, q );

            window.bluetoothle.write(
                function( obj ) {

                    if( !noLog ) {
                        $log.log( 'Write Success: ' + JSON.stringify( obj ) );
                        $log.log( 'Write Success Value: ' + JSON.stringify( $cordovaBluetoothLE.encodedStringToBytes( obj.value ) ) );
                    }

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

        var writeOpCode = function( characteristic, value, shouldWaitForNotification, noLog ) {

            if( !noLog ) {
                $log.log( 'Writing ' + JSON.stringify( value ) + ' to ' + characteristic );
            }

            var params = {
                address: vm.device.address,
                service: Constants.DFU_SERVICE_UUID,
                characteristic: characteristic,
                value: $cordovaBluetoothLE.bytesToEncodedString( value )
            };

            subscriptions[ Constants.DFU_CONTROL_POINT_UUID ] = null;

            return write( params, noLog )
                .then( function() {

                    if( !shouldWaitForNotification ) {
                        return;
                    }

                    return $q( function( resolve ) {
                        waitForNotification( Constants.DFU_CONTROL_POINT_UUID, resolve );
                    } );
                } );
        };

        var formatFirmwareImageSize = function( size ) {

            var buf = new ArrayBuffer( 12 );
            var view = new DataView( buf );

            view.setUint32( 8, size, true );

            return new Uint8Array( buf );
        };

        var wait = function( duration ) {

            var q = $q.defer();

            setTimeout( q.resolve, duration );

            return q.promise;
        };

        var sendImage = function( inputStream ) {

            const MAX_PACKET_SIZE = 20;
            var buffer = new Array( MAX_PACKET_SIZE );
            var bytesSent = 0;
            var packetsSent = 0;

            var startTime = Date.now();
            var lastReportedProgress = 0;

            var sendNextPacket = function() {

                var len = inputStream.readPacket( buffer );
                var waitForNotification = ++packetsSent % Constants.NUMBER_OF_PACKETS_BEFORE_NOTIF === 0;

                return writeOpCode( Constants.DFU_PACKET_UUID, buffer.slice( 0, len ), waitForNotification, false )
                    .then( function() {

                        bytesSent += len;

                        var progress = Math.floor( bytesSent / inputStream.available * 100 );
                        if( progress > 0 && progress % 10 === 0 && progress > lastReportedProgress ) {
                            $log.log( 'Transmission progress: ' + progress + '%' );
                            lastReportedProgress = progress;
                        }

                        if( bytesSent < inputStream.available ) {
                            return sendNextPacket();
                        }

                        var time = ( Date.now() - startTime ) / 1000;
                        $log.log( 'Transmission time: ' + time + 's' );

                        return;
                    } );
            };

            return sendNextPacket();
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

                    return subscribe( params )
                        .then( function() {
                            return wait( 1000 ); // TODO: Probably, can be removed
                        } );
                } )
                .then( function() {

                    $log.log( 'Sending Start DFU command' );
                    return writeOpCode( Constants.DFU_CONTROL_POINT_UUID, Constants.OP_CODE_START_DFU, false );
                } )
                .then( function() {

                    $log.log( 'Resolving firmware file' );
                    return $q( function( resolve, reject ) {

                        window.FilePath.resolveNativePath( firmwareFileUri,
                            function( filePath ) {

                                window.resolveLocalFileSystemURL( filePath,
                                    function( fileEntry ) {

                                        fileEntry.file(
                                            function( file ) {

                                                $log.log( 'Firmware file size: ' + file.size );

                                                var reader = new FileReader();

                                                reader.onloadend = function( evt ) {
                                                    $log.log( JSON.stringify( evt ) );
                                                    resolve( new Uint8Array( evt.target.result ) ); // TODO: Investigate error case
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
                .then( function( fileBuf ) {

                    var inputStream = new HexFileInputStream( fileBuf );

                    $log.log( 'Sending image size: ' + inputStream.available );
                    var sizeArr = formatFirmwareImageSize( inputStream.available );
                    return writeOpCode( Constants.DFU_PACKET_UUID, sizeArr, true )
                        .then( function() {

                            $log.log( 'Sending the number of packets before notifications' );
                            return writeOpCode( Constants.DFU_CONTROL_POINT_UUID, Constants.OP_CODE_PACKET_RECEIPT_NOTIF_REQ, false );
                        } )
                        .then( function() {

                            $log.log( 'Sending Receive Firmware Image request' );
                            return writeOpCode( Constants.DFU_CONTROL_POINT_UUID, Constants.OP_CODE_RECEIVE_FIRMWARE_IMAGE, false );
                        } )
                        .then( function() {

                            $log.log( 'Uploading firmware' );
                            return sendImage( inputStream )
                                .then( function() {
                                    // TODO: Check response
                                    return wait( 2000 );
                                } );
                        } )
                        .then( function() {

                            $log.log( 'Sending Validate request' );
                            return writeOpCode( Constants.DFU_CONTROL_POINT_UUID, Constants.OP_CODE_VALIDATE, true );
                        } )
                        .then( function() {

                            $log.log( 'Sending Activate and Reset request' );
                            return writeOpCode( Constants.DFU_CONTROL_POINT_UUID, Constants.OP_CODE_ACTIVATE_AND_RESET, false );
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
