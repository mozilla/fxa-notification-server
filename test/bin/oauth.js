/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var hapi = require('hapi')
var config = require('../../lib/config')

var server = new hapi.Server()

server.connection({
  host: config.oauth.host,
  port: config.oauth.port
})

server.register(require('../lib/oauth_plugin'), function () {})

server.start()
