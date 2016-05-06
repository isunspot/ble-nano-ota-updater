'use strict';

angular
    .module( 'main', [
        'ionic',
        'ngCordova',
        'ngCordovaBluetoothLE',
        'ui.router'
    ] )
    .config( function( $stateProvider, $urlRouterProvider ) {

        $urlRouterProvider.otherwise( '/main/ota' );
        $stateProvider
            // this state is placed in the <ion-nav-view> in the index.html
            .state( 'main', {
                url: '/main',
                abstract: true,
                templateUrl: 'main/templates/menu.html',
                controller: 'MenuCtrl as menu'
            } )
            .state( 'main.otaList', {
                url: '/ota',
                views: {
                    'pageContent': {
                        templateUrl: 'main/templates/ota-list.html',
                        controller: 'OtaListCtrl as vm'
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
            } )
            .state( 'main.about', {
                url: '/about',
                views: {
                    'pageContent': {
                        templateUrl: 'main/templates/about.html',
                        controller: 'AboutCtrl as vm'
                    }
                }
            } );
    } );
