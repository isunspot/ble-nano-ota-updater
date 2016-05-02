'use strict';

angular
    .module('main')
    .controller('OtaDeviceCtrl', function($cordovaBluetoothLE, $log, $scope, $stateParams, $timeout) {

        var LINE_LENGTH = 128;

        function HexFileInputStream( fileBuf ) {

            this._fileBuf = fileBuf;
            this._pos = 0;
            this._localBuf = new Array( LINE_LENGTH );
            this._localPos = LINE_LENGTH;    // we are at the end of the local buffer, new one must be obtained
            this._size = this._localBuf.length;
            this._lastAddress = 0;
            this._bytesRead = 0;

            this.available = this._calculateImageSize();

            this.reset();
        }

        HexFileInputStream.prototype = {

            reset: function() {
                this._pos = 0;
                this._bytesRead = 0;
                this._localPos = LINE_LENGTH;    // we are at the end of the local buffer, new one must be obtained
            },

            _checkComma: function( symbol ) {

                if( symbol !== 0x3A ) {    // ':'
                    throw new Error( 'Invalid HEX file' );
                }
            },

            _read: function() {
                return this._fileBuf[ this._pos++ ];
            },

            _readByte: function() {

                var first = parseInt( String.fromCharCode( this._read() ), 16 );
                var second = parseInt( String.fromCharCode( this._read() ), 16 );

                return first << 4 | second;
            },

            _readAddress: function() {
                return this._readByte() << 8 | this._readByte();
            },

            _skip: function( count ) {
                this._pos += count;
            },

            _calculateImageSize: function() {

                this.reset();

                var binSize = 0;

                var b, lineSize, offset, type;
                var lastBaseAddress = 0; // last Base Address, default 0
                var lastAddress;

                b = this._read();

                while ( true ) {    // eslint-disable-line no-constant-condition

                    this._checkComma( b );

                    lineSize = this._readByte(); // reading the length of the data in this line
                    offset = this._readAddress();// reading the offset
                    type = this._readByte(); // reading the line type

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
                            var newULBA = this._readAddress();

                            if( binSize > 0 && newULBA !== (lastBaseAddress >> 16) + 1 ) {
                                return binSize;
                            }

                            lastBaseAddress = newULBA << 16;
                            this._skip( 2 ); // skip check sum
                            break;
                        case 0x02:
                            // extended segment address record
                            var newSBA = this._readAddress() << 4;

                            if( binSize > 0 && (newSBA >> 16) !== (lastBaseAddress >> 16) + 1 ) {
                                return binSize;
                            }

                            lastBaseAddress = newSBA;
                            this._skip( 2 ); // skip check sum
                            break;
                        case 0x00:
                            // data type line
                            lastAddress = lastBaseAddress + offset;
                            if( lastAddress >= 0x1000 ) { // we must skip all data from below last MBR address (default 0x1000) as those are the MBR. The Soft Device starts at the end of MBR (0x1000), the app and bootloader farther more
                                binSize += lineSize;
                            }
                            // no break!
                        default:    // eslint-disable-line no-fallthrough
                            this._skip( lineSize * 2 /* 2 hex per one byte */ + 2 /* check sum */ );
                            break;
                    }

                    // skip end of line
                    while ( true ) {    // eslint-disable-line no-constant-condition

                        b = this._read();

                        if( b !== 0x0A && b !== 0x0D ) {
                            break;
                        }
                    }
                }
            },

            _readLine: function() {

                // end of file reached
                if( this._pos === -1 ) {
                    return 0;
                }

                // temporary value
                var b;
                var lineSize, type, offset;
                var address;

                do {
                    // skip end of line
                    while ( true ) {    // eslint-disable-line no-constant-condition
                        b = this._read();

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
                    this._checkComma( b ); // checking the comma at the beginning
                    lineSize = this._readByte(); // reading the length of the data in this line
                    offset = this._readAddress();// reading the offset
                    type = this._readByte(); // reading the line type

                    // if the line type is no longer data type (0x00), we've reached the end of the file
                    switch ( type ) {
                        case 0x00:
                            // data type
                            if( this._lastAddress + offset < 0x1000 ) { // skip MBR
                                type = -1; // some other than 0
                                this._skip( lineSize * 2 /* 2 hex per one byte */ + 2 /* check sum */ );
                            }
                            break;
                        case 0x01:
                            // end of file
                            this._pos = -1;
                            return 0;
                        case 0x02:
                            // extended segment address
                            address = this._readAddress() << 4;

                            if( this._bytesRead > 0 && (address >> 16) !== (this._lastAddress >> 16) + 1 ) {
                                return 0;
                            }

                            this._lastAddress = address;
                            this._skip( 2 /* check sum */ );
                            break;
                        case 0x04:
                            // extended linear address
                            address = this._readAddress();

                            if( this._bytesRead > 0 && address !== (this._lastAddress >> 16) + 1 ) {
                                return 0;
                            }

                            this._lastAddress = address << 16;
                            this._skip( 2 /* check sum */ );
                            break;
                        default:
                            this._skip( lineSize * 2 /* 2 hex per one byte */ + 2 /* check sum */ );
                            break;
                    }
                } while ( type !== 0 );

                // otherwise read lineSize bytes or fill the whole buffer
                for ( var i = 0; i < this._localBuf.length && i < lineSize; ++i ) {
                    b = this._readByte();
                    this._localBuf[ i ] = b;
                }

                this._skip( 2 ); // skip the checksum
                this._localPos = 0;

                return lineSize;
            },

            readPacket: function( buf ) {

                var i = 0;

                while ( i < buf.length ) {
                    if( this._localPos < this._size ) {
                        buf[ i++ ] = this._localBuf[ this._localPos++ ];
                        continue;
                    }

                    this._bytesRead += this._size = this._readLine();
                    if( this._size === 0 ) {
                        break; // end of file reached
                    }
                }

                return i;
            }
        };

        // ---------------------------------------------------------------------

        function FOTAUpdateHelper( device, options ) {

            if( !window.bluetoothle ) {
                throw new Error( 'bluetoothle plugin not found' );
            }

            this._device = device;
            this._options = options || {};

            this._subscriptionNotificationHandler = null;
            this._subscriptionNotificationTimeout = null;

            this._eventCallbacks = {};
        }

        FOTAUpdateHelper.LOG_LEVEL_NO_LOGS = 0;
        FOTAUpdateHelper.LOG_LEVEL_DEBUG = 1;
        FOTAUpdateHelper.LOG_LEVEL_INFO = 2;
        FOTAUpdateHelper.LOG_LEVEL_ERROR = 3;

        FOTAUpdateHelper.GENERIC_ATTRIBUTE_SERVICE_UUID = '00001801-0000-1000-8000-00805f9b34fb';
        FOTAUpdateHelper.SERVICE_CHANGED_UUID = '00002a05-0000-1000-8000-00805f9b34fb';
        FOTAUpdateHelper.DFU_SERVICE_UUID = '00001530-1212-efde-1523-785feabcd123';
        FOTAUpdateHelper.DFU_CONTROL_POINT_UUID = '00001531-1212-efde-1523-785feabcd123';
        FOTAUpdateHelper.DFU_PACKET_UUID = '00001532-1212-efde-1523-785feabcd123';
        FOTAUpdateHelper.DFU_VERSION_UUID = '00001534-1212-efde-1523-785feabcd123';

        FOTAUpdateHelper.NUMBER_OF_PACKETS_BEFORE_NOTIF = 12;
        FOTAUpdateHelper.MAX_PACKET_SIZE = 20;

        FOTAUpdateHelper.DFU_STATUS_SUCCESS = 1;
        FOTAUpdateHelper.DFU_STATUS_INVALID_STATE = 2;
        FOTAUpdateHelper.DFU_STATUS_NOT_SUPPORTED = 3;
        FOTAUpdateHelper.DFU_STATUS_DATA_SIZE_EXCEEDS_LIMIT = 4;
        FOTAUpdateHelper.DFU_STATUS_CRC_ERROR = 5;
        FOTAUpdateHelper.DFU_STATUS_OPERATION_FAILED = 6;

        FOTAUpdateHelper.OP_CODE_START_DFU_KEY = 0x01; // 1
        FOTAUpdateHelper.OP_CODE_INIT_DFU_PARAMS_KEY = 0x02; // 2
        FOTAUpdateHelper.OP_CODE_RECEIVE_FIRMWARE_IMAGE_KEY = 0x03; // 3
        FOTAUpdateHelper.OP_CODE_VALIDATE_KEY = 0x04; // 4
        FOTAUpdateHelper.OP_CODE_ACTIVATE_AND_RESET_KEY = 0x05; // 5
        FOTAUpdateHelper.OP_CODE_RESET_KEY = 0x06; // 6
        FOTAUpdateHelper.OP_CODE_PACKET_RECEIPT_NOTIF_REQ_KEY = 0x08; // 8
        FOTAUpdateHelper.OP_CODE_RESPONSE_CODE_KEY = 0x10; // 16
        FOTAUpdateHelper.OP_CODE_PACKET_RECEIPT_NOTIF_KEY = 0x11; // 17

        FOTAUpdateHelper.OP_CODE_START_DFU = [ FOTAUpdateHelper.OP_CODE_START_DFU_KEY, 0x04 ]; // always application
        FOTAUpdateHelper.OP_CODE_INIT_DFU_PARAMS_START = [ FOTAUpdateHelper.OP_CODE_INIT_DFU_PARAMS_KEY, 0x00 ];
        FOTAUpdateHelper.OP_CODE_INIT_DFU_PARAMS_COMPLETE = [ FOTAUpdateHelper.OP_CODE_INIT_DFU_PARAMS_KEY, 0x01 ];
        FOTAUpdateHelper.OP_CODE_RECEIVE_FIRMWARE_IMAGE = [ FOTAUpdateHelper.OP_CODE_RECEIVE_FIRMWARE_IMAGE_KEY ];
        FOTAUpdateHelper.OP_CODE_VALIDATE = [ FOTAUpdateHelper.OP_CODE_VALIDATE_KEY ];
        FOTAUpdateHelper.OP_CODE_ACTIVATE_AND_RESET = [ FOTAUpdateHelper.OP_CODE_ACTIVATE_AND_RESET_KEY ];
        FOTAUpdateHelper.OP_CODE_RESET = [ FOTAUpdateHelper.OP_CODE_RESET_KEY ];
        FOTAUpdateHelper.OP_CODE_PACKET_RECEIPT_NOTIF_REQ = [ FOTAUpdateHelper.OP_CODE_PACKET_RECEIPT_NOTIF_REQ_KEY, FOTAUpdateHelper.NUMBER_OF_PACKETS_BEFORE_NOTIF, 0x00 ];

        FOTAUpdateHelper.EVENT_UPDATE_STATE_CHANGE = 'state-change';
        FOTAUpdateHelper.EVENT_UPLOAD_PROGRESS = 'upload-progress';
        FOTAUpdateHelper.EVENT_ERROR = 'error';

        FOTAUpdateHelper.STATE_CHECKING_PRECONDITIONS = 'checking-preconditions';
        FOTAUpdateHelper.STATE_CONNECTING_TO_DEVICE = 'connecting-to-device';
        FOTAUpdateHelper.STATE_CLOSING_DEVICE_CONNECTION = 'closing-device-connection';
        FOTAUpdateHelper.STATE_DISCOVERING_SERVICES = 'discovering-services';
        FOTAUpdateHelper.STATE_SUBSCRIBING_FOR_NOTIFICATIONS = 'subscribing-for-notifications';
        FOTAUpdateHelper.STATE_UNSUBSCRIBING_FOR_NOTIFICATIONS = 'unsubscribing-for-notifications';
        FOTAUpdateHelper.STATE_STARTING_DFU = 'starting-dfu';
        FOTAUpdateHelper.STATE_INITIALIZING_IMAGE_UPLOAD = 'initializing-image-upload';
        FOTAUpdateHelper.STATE_UPLOADING_IMAGE = 'uploading-image';
        FOTAUpdateHelper.STATE_VALIDATING_UPLOADED_IMAGE = 'validating-uploaded-image';
        FOTAUpdateHelper.STATE_RESTARTING_DEVICE = 'restarting-device';

        FOTAUpdateHelper.prototype = {

            _logd: function( message ) {
                if( this._options.logLevel && this._options.logLevel <= FOTAUpdateHelper.LOG_LEVEL_DEBUG ) {
                    console.debug( message );   // eslint-disable-line no-console
                }
            },

            _logi: function( message ) {
                if( this._options.logLevel && this._options.logLevel <= FOTAUpdateHelper.LOG_LEVEL_INFO ) {
                    console.info( message );   // eslint-disable-line no-console
                }
            },

            _loge: function( message ) {
                if( this._options.logLevel && this._options.logLevel <= FOTAUpdateHelper.LOG_LEVEL_ERROR ) {
                    console.error( message );   // eslint-disable-line no-console
                }
            },

            _createTimeout: function( options, reject ) {

                var timeout = options && options.timeout ? options.timeout : 5000;
                return setTimeout( function() {
                    reject( new Error( 'Operation timeout' ) );
                }, timeout );
            },

            _cancelTimeout: function( timeout ) {
                clearTimeout( timeout );
            },

            _wait: function( duration ) {
                return new Promise( function( resolve ) {
                    setTimeout( resolve, duration );
                } );
            },

            _setupSubscriptionNotification: function( resolve, reject ) {
                this._subscriptionNotificationTimeout = this._createTimeout( { timeout: 20000 }, reject );
                this._subscriptionNotificationHandler = resolve;
            },

            _resolveSubscriptionNotification: function( payload ) {

                if( this._subscriptionNotificationTimeout ) {
                    this._cancelTimeout( this._subscriptionNotificationTimeout );
                    this._subscriptionNotificationTimeout = null;
                }

                if( this._subscriptionNotificationHandler ) {
                    var handler = this._subscriptionNotificationHandler;
                    this._subscriptionNotificationHandler = null;
                    handler( payload );
                }
            },

            _parseResult: function( result ) {

                if( !result || !result.value ) {
                    return {
                        opCode: 0,
                        reqOpCode: 0,
                        status: 0
                    };
                }

                return {
                    opCode: result.value[ 0 ],
                    requestOpCode: result.value[ 1 ],
                    status: result.value[ 2 ]
                };
            },

            _emit: function( event, payload ) {

                var listeners = this._eventCallbacks[ event ];

                if( !listeners ) {
                    return;
                }

                listeners.forEach( function( listener ) {
                    listener( payload );
                } );
            },

            on: function( event, callback ) {

                if( typeof callback !== 'function' ) {
                    throw new Error( 'Callback must be a function' );
                }

                this._eventCallbacks[ event ] = this._eventCallbacks[ event ] || [];
                this._eventCallbacks[ event ].push( callback );

                return this;
            },

            isInitialized: function() {

                return new Promise( function( resolve ) {
                    window.bluetoothle.isInitialized( function( obj ) {
                        resolve( obj );
                    } );
                } );
            },

            isEnabled: function() {

                return new Promise( function( resolve ) {
                    window.bluetoothle.isEnabled( function( obj ) {
                        resolve( obj );
                    } );
                } );
            },

            connect: function() {

                var self = this;

                var params = {
                    address: self._device.address
                };

                return new Promise( function( resolve, reject ) {

                    var timeout = self._createTimeout( params, reject );

                    window.bluetoothle.connect(
                        function( obj ) {
                            self._logd( 'Connect success: ' + JSON.stringify( obj ) );

                            self._cancelTimeout( timeout );

                            if( obj.status === 'disconnected' ) {
                                self.close( { address: obj.address } );
                            }

                            resolve( obj );
                        },
                        function( obj ) {
                            self._loge( 'Connect error: ' + JSON.stringify( obj ) );

                            self.close( { address: obj.address } );
                            self._cancelTimeout( timeout );

                            reject( obj );
                        },
                        params
                    );
                } );
            },

            close: function() {

                var self = this;

                var params = {
                    address: self._device.address
                };

                return new Promise( function( resolve ) {

                    window.bluetoothle.close(
                        function( obj ) {
                            self._logd( 'Close success: ' + JSON.stringify( obj ) );
                            resolve( obj );
                        },
                        function( obj ) {
                            self._loge( 'Close error: ' + JSON.stringify( obj ) );
                            resolve( obj ); // Not rejecting in case of error
                        },
                        params
                    );
                } );
            },

            discoverServices: function() {

                var self = this;

                var params = {
                    address: self._device.address
                };

                return new Promise( function( resolve, reject ) {

                    var timeout = self._createTimeout( params, reject );

                    window.bluetoothle.discover(
                        function( obj ) {
                            self._logd( 'Discover Services success: ' + JSON.stringify( obj ) );

                            self._cancelTimeout( timeout );

                            resolve( obj );
                        },
                        function( obj ) {
                            self._loge( 'Discover Services error: ' + JSON.stringify( obj ) );

                            self._cancelTimeout( timeout );

                            reject( obj );
                        },
                        params
                    );
                } );
            },

            subscribe: function() {

                var self = this;

                var params = {
                    address: self._device.address,
                    service: FOTAUpdateHelper.DFU_SERVICE_UUID,
                    characteristic: FOTAUpdateHelper.DFU_CONTROL_POINT_UUID
                };

                return new Promise( function( resolve, reject ) {

                    var timeout = self._createTimeout( params, reject );

                    window.bluetoothle.subscribe(
                        function( obj ) {
                            self._logd( 'Subscribe success: ' + JSON.stringify( obj ) );

                            self._cancelTimeout( timeout );

                            if( obj.status === 'subscribedResult' ) {
                                var value = window.bluetoothle.encodedStringToBytes( obj.value );

                                self._logd( 'Decoded result: ' + JSON.stringify( value ) );

                                obj.value = value;
                                self._resolveSubscriptionNotification( obj );
                            }

                            resolve( obj );
                        },
                        function( obj ) {
                            self._loge( 'Subscribe error: ' + JSON.stringify( obj ) );

                            self._cancelTimeout( timeout );

                            reject( obj );
                        },
                        params
                    );
                } );
            },

            unsubscribe: function() {

                var self = this;

                var params = {
                    address: self._device.address,
                    service: FOTAUpdateHelper.DFU_SERVICE_UUID,
                    characteristic: FOTAUpdateHelper.DFU_CONTROL_POINT_UUID
                };

                return new Promise( function( resolve, reject ) {

                    var timeout = self._createTimeout( params, reject );

                    window.bluetoothle.unsubscribe(
                        function( obj ) {
                            self._logd( 'Unsubscribe success: ' + JSON.stringify( obj ) );

                            self._cancelTimeout( timeout );

                            resolve( obj );
                        },
                        function( obj ) {
                            self._loge( 'Unsubscribe error: ' + JSON.stringify( obj ) );

                            self._cancelTimeout( timeout );

                            reject( obj );
                        },
                        params
                    );
                } );
            },

            write: function( characteristic, value, waitForNotification ) {

                var self = this;

                self._logd( 'Writing ' + JSON.stringify( value ) + ' to ' + characteristic );

                var params = {
                    address: self._device.address,
                    service: FOTAUpdateHelper.DFU_SERVICE_UUID,
                    characteristic: characteristic,
                    value: window.bluetoothle.bytesToEncodedString( value )
                };

                return new Promise( function( resolve, reject ) {

                    if( waitForNotification ) {
                        self._setupSubscriptionNotification( resolve, reject );
                    }

                    var timeout = self._createTimeout( params, reject );

                    window.bluetoothle.write(
                        function( obj ) {
                            self._logd( 'Write success: ' + JSON.stringify( obj ) );

                            self._cancelTimeout( timeout );

                            if( !waitForNotification ) {
                                return resolve( obj );
                            }
                        },
                        function( obj ) {
                            self._loge( 'Write error: ' + JSON.stringify( obj ) );

                            self._cancelTimeout( timeout );

                            reject( obj );
                        },
                        params
                    );
                } );
            },

            uploadImage: function( inputStream ) {

                var self = this;

                var buffer = new Array( FOTAUpdateHelper.MAX_PACKET_SIZE );
                var bytesSent = 0;
                var packetsSent = 0;
                var lastReportedProgress = 0;

                var sendNextPacket = function() {

                    var len = inputStream.readPacket( buffer );
                    var lastPacket = bytesSent + len === inputStream.available;
                    var waitForNotification = ++packetsSent % FOTAUpdateHelper.NUMBER_OF_PACKETS_BEFORE_NOTIF === 0 || lastPacket;

                    return self.write( FOTAUpdateHelper.DFU_PACKET_UUID, buffer.slice( 0, len ), waitForNotification )
                        .then( function( writeResult ) {

                            if( waitForNotification ) {
                                var result = self._parseResult( writeResult );

                                if( lastPacket ) {
                                    if( result.opCode !== FOTAUpdateHelper.OP_CODE_RESPONSE_CODE_KEY ||
                                        result.requestOpCode !== FOTAUpdateHelper.OP_CODE_RECEIVE_FIRMWARE_IMAGE_KEY ||
                                        result.status !== FOTAUpdateHelper.DFU_STATUS_SUCCESS ) {
                                        throw new Error( 'Failed to upload image. Wrong confirmation response: ' + JSON.stringify( result ) );
                                    }
                                } else {
                                    if( result.opCode !== FOTAUpdateHelper.OP_CODE_PACKET_RECEIPT_NOTIF_KEY ) {
                                        throw new Error( 'Failed to upload image. Unexpected response: ' + JSON.stringify( result ) );
                                    }
                                }
                            }

                            bytesSent += len;

                            var progress = Math.floor( bytesSent / inputStream.available * 100 );
                            if( progress > 0 && progress > lastReportedProgress ) {
                                self._logd( 'Transmission progress: ' + progress + '%' );

                                self._emit( FOTAUpdateHelper.EVENT_UPLOAD_PROGRESS, {
                                    progress: progress,
                                    bytesSent: bytesSent,
                                    bytesTotal: inputStream.available
                                } );

                                lastReportedProgress = progress;
                            }

                            if( bytesSent < inputStream.available ) {
                                return sendNextPacket();
                            }

                            self._logd( 'Packets sent: ' + packetsSent );
                        } );
                };

                inputStream.reset();
                return sendNextPacket();
            },

            formatFirmwareImageSize: function( size ) {

                var buf = new ArrayBuffer( 12 );
                var view = new DataView( buf );

                view.setUint32( 8, size, true );

                return new Uint8Array( buf );
            },

            uploadFirmware: function( firmwareBuf ) {

                var self = this;

                if( !firmwareBuf || firmwareBuf.length === 0 ) {
                    return Promise.reject( new Error( 'Invalid firmware buffer' ) );
                }

                self._logi( 'Starting OTA update' );

                self._logi( 'Checking if bluetooth is initialized' );
                self._emit( FOTAUpdateHelper.EVENT_UPDATE_STATE_CHANGE, { state: FOTAUpdateHelper.STATE_CHECKING_PRECONDITIONS } );
                return self.isInitialized()
                    .then( function( initializedResult ) {

                        if( !initializedResult.isInitialized ) {
                            throw new Error( 'Bluetooth must be initialized' );
                        }

                        self._logi( 'Checking if bluetooth is enabled' );
                        return self.isEnabled()
                            .then( function( enabledResult ) {

                                if( !enabledResult.isEnabled ) {
                                    throw new Error( 'Bluetooth must be enabled' );
                                }
                            } );
                    } )
                    .then( function() {

                        self._logi( 'Connecting to device' );
                        self._emit( FOTAUpdateHelper.EVENT_UPDATE_STATE_CHANGE, { state: FOTAUpdateHelper.STATE_CONNECTING_TO_DEVICE } );
                        return self.connect()
                            .then( function( result ) {

                                if( result.status !== 'connected' ) {
                                    throw new Error( 'Failed to connect to the device' );
                                }
                            } );
                    } )
                    .then( function() {

                        self._logi( 'Discovering services' );
                        self._emit( FOTAUpdateHelper.EVENT_UPDATE_STATE_CHANGE, { state: FOTAUpdateHelper.STATE_DISCOVERING_SERVICES } );
                        return self.discoverServices()
                            .then( function( result ) {

                                if( result.status !== 'discovered' ) {
                                    throw new Error( 'Failed to discover services' );
                                }

                                var dfuService = result.services.find( function( service ) {
                                    return service.uuid === FOTAUpdateHelper.DFU_SERVICE_UUID;
                                } );

                                if( !dfuService ) {
                                    throw new Error( 'DFU service not found' );
                                }
                            } );
                    } )
                    .then( function() {

                        self._logi( 'Subscribing for notifications' );
                        self._emit( FOTAUpdateHelper.EVENT_UPDATE_STATE_CHANGE, { state: FOTAUpdateHelper.STATE_SUBSCRIBING_FOR_NOTIFICATIONS } );
                        return self.subscribe();
                    } )
                    .then( function() {

                        self._logi( 'Sending Start DFU command' );
                        self._emit( FOTAUpdateHelper.EVENT_UPDATE_STATE_CHANGE, { state: FOTAUpdateHelper.STATE_STARTING_DFU } );
                        return self.write( FOTAUpdateHelper.DFU_CONTROL_POINT_UUID, FOTAUpdateHelper.OP_CODE_START_DFU, false );
                    } )
                    .then( function() {

                        self._emit( FOTAUpdateHelper.EVENT_UPDATE_STATE_CHANGE, { state: FOTAUpdateHelper.STATE_INITIALIZING_IMAGE_UPLOAD } );

                        var inputStream = new HexFileInputStream( firmwareBuf );

                        self._logi( 'Sending image size: ' + inputStream.available );
                        var sizeArr = self.formatFirmwareImageSize( inputStream.available );
                        return self.write( FOTAUpdateHelper.DFU_PACKET_UUID, sizeArr, true )
                            .then( function( sizeResult ) {

                                var result = self._parseResult( sizeResult );
                                if( result.requestOpCode !== FOTAUpdateHelper.OP_CODE_START_DFU_KEY ||
                                    result.status !== FOTAUpdateHelper.DFU_STATUS_SUCCESS ) {
                                    throw new Error( 'Failed to send image size. Response: ' + JSON.stringify( result ) );
                                }

                                self._logi( 'Sending the number of packets before notification' );
                                return self.write( FOTAUpdateHelper.DFU_CONTROL_POINT_UUID, FOTAUpdateHelper.OP_CODE_PACKET_RECEIPT_NOTIF_REQ, false );
                            } )
                            .then( function() {

                                self._logi( 'Sending Receive Firmware Image request' );
                                return self.write( FOTAUpdateHelper.DFU_CONTROL_POINT_UUID, FOTAUpdateHelper.OP_CODE_RECEIVE_FIRMWARE_IMAGE, false );
                            } )
                            .then( function() {

                                var startTime = Date.now();

                                self._logi( 'Uploading firmware' );
                                self._emit( FOTAUpdateHelper.EVENT_UPDATE_STATE_CHANGE, { state: FOTAUpdateHelper.STATE_UPLOADING_IMAGE } );
                                return self.uploadImage( inputStream )
                                    .then( function() {

                                        var time = ( Date.now() - startTime ) / 1000;
                                        self._logi( 'Transmission time: ' + time + 's' );

                                        return self._wait( 2000 );
                                    } );
                            } );
                    } )
                    .then( function() {

                        self._logi( 'Sending Validate request' );
                        self._emit( FOTAUpdateHelper.EVENT_UPDATE_STATE_CHANGE, { state: FOTAUpdateHelper.STATE_VALIDATING_UPLOADED_IMAGE } );
                        return self.write( FOTAUpdateHelper.DFU_CONTROL_POINT_UUID, FOTAUpdateHelper.OP_CODE_VALIDATE, true )
                            .then( function( validationResult ) {

                                var result = self._parseResult( validationResult );
                                if( result.requestOpCode !== FOTAUpdateHelper.OP_CODE_VALIDATE_KEY ||
                                    result.status !== FOTAUpdateHelper.DFU_STATUS_SUCCESS ) {
                                    throw new Error( 'Failed to validate image. Response: ' + JSON.stringify( result ) );
                                }
                            } );
                    } )
                    .then( function() {

                        self._logi( 'Canceling subscription for notifications' );
                        self._emit( FOTAUpdateHelper.EVENT_UPDATE_STATE_CHANGE, { state: FOTAUpdateHelper.STATE_UNSUBSCRIBING_FOR_NOTIFICATIONS } );
                        return self.unsubscribe();
                    } )
                    .then( function() {

                        self._logi( 'Sending Activate and Reset request' );
                        self._emit( FOTAUpdateHelper.EVENT_UPDATE_STATE_CHANGE, { state: FOTAUpdateHelper.STATE_RESTARTING_DEVICE } );
                        self._disconnectionExpected = true;
                        return self.write( FOTAUpdateHelper.DFU_CONTROL_POINT_UUID, FOTAUpdateHelper.OP_CODE_ACTIVATE_AND_RESET, false );
                    } )
                    .then( function() {

                        self._logi( 'Closing connection to device' );
                        self._emit( FOTAUpdateHelper.EVENT_UPDATE_STATE_CHANGE, { state: FOTAUpdateHelper.STATE_CLOSING_DEVICE_CONNECTION } );
                        return self.close();
                    } )
                    .catch( function( err ) {

                        var message = err instanceof Error ? JSON.stringify( err, [ 'message' ] ) : JSON.stringify( err );
                        self._loge( 'Update failed: ' + message );

                        self._emit( FOTAUpdateHelper.EVENT_ERROR, { err: err } );
                        self.close();
                    } );
            }
        };

        // ---------------------------------------------------------------------

        var vm = this;

        vm.device = $stateParams.device;
        vm.connected = false;
        vm.stateMessage = 'Press Update Button';

        // var firmwareFileUri = 'content://com.android.providers.downloads.documents/document/16535';
        vm.firmwareFileBuf;

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

            var helper = new FOTAUpdateHelper( vm.device, { logLevel: FOTAUpdateHelper.LOG_LEVEL_DEBUG } );

            helper
                .on( FOTAUpdateHelper.EVENT_UPLOAD_PROGRESS, function( payload ) {
                    $log.debug( payload.progress + '%' );
                    updateStateMessage( 'Uploading image: ' + payload.progress + '%' );
                } )
                .on( FOTAUpdateHelper.EVENT_UPDATE_STATE_CHANGE, function( payload ) {

                    switch ( payload.state ) {
                        case FOTAUpdateHelper.STATE_CHECKING_PRECONDITIONS:
                            updateStateMessage( 'Checking preconditions' );
                            break;

                        case FOTAUpdateHelper.STATE_CONNECTING_TO_DEVICE:
                            updateStateMessage( 'Connecting to device' );
                            break;

                        case FOTAUpdateHelper.STATE_DISCOVERING_SERVICES:
                            updateStateMessage( 'Discovering services' );
                            break;

                        case FOTAUpdateHelper.STATE_SUBSCRIBING_FOR_NOTIFICATIONS:
                            updateStateMessage( 'Subscribing for notifications' );
                            break;

                        case FOTAUpdateHelper.STATE_STARTING_DFU:
                            updateStateMessage( 'Starting DFU' );
                            break;

                        case FOTAUpdateHelper.STATE_INITIALIZING_IMAGE_UPLOAD:
                            updateStateMessage( 'Initializing image upload' );
                            break;

                        case FOTAUpdateHelper.STATE_UPLOADING_IMAGE:
                            updateStateMessage( 'Uploading image: 0%' );
                            break;

                        case FOTAUpdateHelper.STATE_VALIDATING_UPLOADED_IMAGE:
                            updateStateMessage( 'Validating uploaded image' );
                            break;

                        case FOTAUpdateHelper.STATE_RESTARTING_DEVICE:
                            updateStateMessage( 'Restarting device' );
                            break;

                        case FOTAUpdateHelper.STATE_UNSUBSCRIBING_FOR_NOTIFICATIONS:
                            updateStateMessage( 'Canceling subscription for notifications' );
                            break;

                        case FOTAUpdateHelper.STATE_CLOSING_DEVICE_CONNECTION:
                            updateStateMessage( 'Done!' );
                            break;
                    }
                } )
                .on( FOTAUpdateHelper.EVENT_ERROR, function( err ) {
                    $log.error( 'Failed to upload firmware: ' + JSON.stringify( err ) );
                    updateStateMessage( 'Sorry, error occurred' );
                } );

            helper.uploadFirmware( vm.firmwareFileBuf );
        };

        vm.selectFirmwareFile = function() {

            return chooseLocalFile()
                .then( function( fileUri ) {

                    return readFirmwareFile( fileUri )
                        .then( function( fileBuf ) {
                            $timeout( function() { vm.firmwareFileBuf = fileBuf; } );
                        } );
                } )
                .catch( function( err ) {
                    $log.error( 'Failed to load firmware file: ' + JSON.stringify( err ) );
                } );
        };
    } );
