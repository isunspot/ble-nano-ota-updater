#!/bin/bash
set -eu

VERSION="$(gulp config --silent --getWidgetAttr=version)"

gulp build --buildVars="version:${VERSION},build:${CIRCLE_SHA1}" --env=dev --minify
gulp --cordova 'build android --debug' --no-build
