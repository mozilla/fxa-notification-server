/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var config = require('./config')
var mozlog = require('mozlog')
mozlog.config({
  app: 'fxa-notification-server',
  level: config.log.level,
  fmt: config.log.fmt
})
module.exports = mozlog('fxa-ns')
