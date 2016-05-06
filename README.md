# BLE Nano OTA Updater

This project is a sample [Apache Cordova](https://cordova.apache.org/) application that performs [RedBear BLE Nano](http://redbearlab.com/blenano/) OTA update using [ble-nano-ota-updater plugin](https://github.com/CanTireInnovations/cordova-plugin-ble-nano-ota-updater).

## Using the Code

To build the project, you need:

*   [`nodejs` and `npm`](https://nodejs.org/en/)
*   [`bower`](http://bower.io/)
*   [`gulp`](http://gulpjs.com/)
*   [Android SDK](http://developer.android.com/sdk/index.html)
*   An Android device [configured for debugging](http://developer.android.com/tools/device.html)

Note, that `Cordova CLI` is installed locally and should be accessed through wrapper. Check [Generator-M-Ionic section](#generator-m-ionic) or [original documentation](https://github.com/mwaylabs/generator-m-ionic/blob/master/docs/start/development_intro.md#using-the-cordova-cli) for better understanding.

### Building the App

Open a new terminal at the project root and follow these steps:

1.  Install the dependencies

    ```sh
    > npm install
    > bower install
    ```

2.  Install Apache Cordova dependencies

    ```sh
    > gulp --cordova "prepare"
    ```
    
3.  Plug in Android device

4.  Deploy and run the app on the Android device

    ```sh
    > gulp --cordova "run android"
    ```

### Generator-M-Ionic

Structure of this project was generated using [Generator-M-Ionic](https://github.com/mwaylabs/generator-m-ionic). Please, check [original documentation](https://github.com/mwaylabs/generator-m-ionic) to better understand provided tools and available options.

## License

This application is licensed under The MIT License. Some parts are licensed under different licenses. Please, check [LICENSE-3RD-PARTY.md](LICENSE-3RD-PARTY.md) for details.