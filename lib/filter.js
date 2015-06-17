/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var jws = require('jws')

function Filter(options) {
  this.src = options || {}
  this.filters = Object.keys(this.src).map(
    function (key) {
      return { key: key, val: options[key] }
    }
  )
}

Filter.prototype.toJSON = function () {
  return this.src
}

Filter.prototype.test = function (str) {
  try {
    return this.testJWT(jws.decode(str, { json: true }))
  } catch (e) {
    /* istanbul ignore next */
    return false
  }
}

Filter.prototype.testJWT = function (jwt) {
  var payload = jwt.payload
  return this.filters.every(
    function (f) {
      return payload[f.key] && payload[f.key] === f.val
    }
  )
}

module.exports = Filter
