'use strict';

describe( 'module: main, controller: OtaCtrl', function() {

    // load the controller's module
    beforeEach( module( 'main' ) );
    // load all the templates to prevent unexpected $http requests from ui-router
    beforeEach( module( 'ngHtml2Js' ) );

    // instantiate controller
    var OtaCtrl;
    beforeEach( inject( function( $controller ) {
        OtaCtrl = $controller( 'OtaCtrl' );
    } ) );

    it( 'should do something', function() {
        expect( !!OtaCtrl ).toBe( true ); // eslint-disable-line no-implicit-coercion
    } );

} );
