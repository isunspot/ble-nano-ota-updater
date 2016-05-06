'use strict';

angular
    .module( 'main' )
    .controller( 'AboutCtrl', function( $log ) {

        var vm = this;

        vm.librariesByLicense = {
            'MIT': {
                name: 'The MIT License (MIT)',
                url: 'https://opensource.org/licenses/MIT',
                libraries: [
                    {
                        name: 'AngularJS',
                        url: 'http://angularjs.org',
                        copyright: 'Copyright (c) 2010 Google, Inc.'
                    },
                    {
                        name: 'angular-animate',
                        url: 'https://github.com/angular/bower-angular-animate',
                        copyright: 'Copyright (c) 2010 Google, Inc.'
                    },
                    {
                        name: 'angular-sanitize',
                        url: 'https://github.com/angular/bower-angular-sanitize',
                        copyright: 'Copyright (c) 2010 Google, Inc.'
                    },
                    {
                        name: 'angular-ui-router',
                        url: 'https://github.com/angular-ui/ui-router',
                        copyright: 'Copyright (c) 2013 The AngularUI Team, Karsten Sperling'
                    },
                    {
                        name: 'cordova-plugin-ble-nano-ota-updater',
                        url: 'https://github.com/CanTireInnovations/cordova-plugin-ble-nano-ota-updater',
                        copyright: 'Copyright (c) 2016 Canadian Tire Corporation'
                    },
                    {
                        name: 'cordova-plugin-bluetoothle',
                        url: 'https://github.com/randdusing/cordova-plugin-bluetoothle',
                        copyright: 'Copyright (c) 2016 Rand Dusing and contributors'
                    },
                    {
                        name: 'Ionic',
                        url: 'http://ionicframework.com',
                        copyright: 'Copyright (c) 2013 Drifty Co.'
                    },
                    {
                        name: 'ngCordova',
                        url: 'http://ngcordova.com',
                        copyright: 'Copyright (c) 2014 Drifty Co.'
                    },
                    {
                        name: 'ng-cordova-bluetoothle',
                        url: 'https://github.com/randdusing/ng-cordova-bluetoothle',
                        copyright: 'Copyright (c) 2015 Jewelbots Inc.'
                    }
                ]
            },
            'Apache': {
                name: 'Apache 2.0 License',
                url: 'http://www.apache.org/licenses/LICENSE-2.0',
                libraries: [
                    {
                        name: 'cordova-plugin-compat',
                        url: 'https://github.com/apache/cordova-plugin-compat',
                        copyright: 'Copyright 2016 The Apache Software Foundation'
                    },
                    {
                        name: 'cordova-plugin-device',
                        url: 'https://github.com/apache/cordova-plugin-device',
                        copyright: 'Copyright 2012 The Apache Software Foundation'
                    },
                    {
                        name: 'cordova-plugin-file',
                        url: 'https://github.com/apache/cordova-plugin-file',
                        copyright: 'Copyright 2012 The Apache Software Foundation'
                    },
                    {
                        name: 'cordova-plugin-file-transfer',
                        url: 'https://github.com/apache/cordova-plugin-file-transfer',
                        copyright: 'Copyright 2012 The Apache Software Foundation'
                    },
                    {
                        name: 'cordova-plugin-whitelist',
                        url: 'https://github.com/apache/cordova-plugin-whitelist',
                        copyright: 'Copyright 2012 The Apache Software Foundation'
                    },
                    {
                        name: 'localForage',
                        url: 'https://github.com/mozilla/localForage',
                        copyright: 'Copyright 2014 Mozilla'
                    }
                ]
            }
        };
    } );
