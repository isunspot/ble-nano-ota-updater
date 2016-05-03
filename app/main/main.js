'use strict';

angular
    .module( 'main', [
        'ionic',
        'ngCordova',
        'ngCordovaBluetoothLE',
        'ui.router'
    ] )
    .config( function( $stateProvider, $urlRouterProvider ) {

        // ROUTING with ui.router
        $urlRouterProvider.otherwise( '/main/ota' );
        $stateProvider
        // this state is placed in the <ion-nav-view> in the index.html
            .state( 'main', {
                url: '/main',
                abstract: true,
                templateUrl: 'main/templates/menu.html',
                controller: 'MenuCtrl as menu'
            } )
            .state( 'main.list', {
                url: '/list',
                views: {
                    'pageContent': {
                        templateUrl: 'main/templates/list.html',
                        // controller: '<someCtrl> as vm'
                    }
                }
            } )
            .state( 'main.listDetail', {
                url: '/list/detail',
                views: {
                    'pageContent': {
                        templateUrl: 'main/templates/list-detail.html',
                        // controller: '<someCtrl> as vm'
                    }
                }
            } )
            .state( 'main.debug', {
                url: '/debug',
                views: {
                    'pageContent': {
                        templateUrl: 'main/templates/debug.html',
                        controller: 'DebugCtrl as vm'
                    }
                }
            } )
            .state( 'main.ota', {
                url: '/ota',
                views: {
                    'pageContent': {
                        templateUrl: 'main/templates/ota.html',
                        controller: 'OtaCtrl as vm'
                    }
                }
            } )
            .state( 'main.otaDevice', {
                url: '/ota/device',
                views: {
                    'pageContent': {
                        templateUrl: 'main/templates/ota-device.html',
                        controller: 'OtaDeviceCtrl as vm'
                    }
                },
                params: {
                    device: null
                }
            } );
    } );
