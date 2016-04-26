'use strict';

describe('module: main, controller: OtaDeviceCtrl', function() {

    // load the controller's module
    beforeEach( module( 'main' ) );
    // load all the templates to prevent unexpected $http requests from ui-router
    beforeEach( module( 'ngHtml2Js' ) );

    // instantiate controller
    var OtaDeviceCtrl;
    beforeEach( inject( function( $controller ) {
        OtaDeviceCtrl = $controller( 'OtaDeviceCtrl' );
    } ) );

    it( 'should do something', function() {
        expect( !!OtaDeviceCtrl ).toBe( true );
    } );

} );
