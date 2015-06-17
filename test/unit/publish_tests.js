/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var test = require('../lib/ptaptest')
var config = require('../../lib/config')
var TestServer = require('../lib/test_server')
var r = require('../../lib/prequest')
var JWK = require('fxa-jwtool').JWK

var keys = require('../../lib/keys')(config)
var base = 'http://' + config.server.host + ':' + config.server.port
var publish = base + '/v0/publish'
var events = base + '/v0/events'
var unavailableJKU = 'http://127.0.0.1:666'
var badJKU = events
var authHeaders = {
  'Authorization': 'Bearer foo-bar-notify'
}

function mangle(jwt) {
  var parts = jwt.split('.')
  parts[1] = keys.secret.signSync({ baz: true }).split('.')[1]
  return parts.join('.')
}

config.jwk.trustedJKUs.push(unavailableJKU)
config.jwk.trustedJKUs.push(badJKU)

TestServer.start(config)
.then(function (server){

  test(
    'joi jwt validation',
    function (t) {
      return r.postAsync(
        {
          url: publish,
          json: {
            events: ['invalid base64url encoding']
          }
        }
      )
      .then(
        function (result) {
          var res = result[0]
          t.equal(res.statusCode, 400)
        }
      )
    }
  )

  test(
    'bad jwt signature',
    function (t) {
      var jwt = mangle(keys.secret.signSync({ bar: true }))

      return r.postAsync(
        {
          url: publish,
          json: {
            events: [jwt]
          }
        }
      )
      .then(
        function (result) {
          t.equal(result[0].statusCode, 400)
          t.equal(result[1].message, 'invalid')
        }
      )
    }
  )

  test(
    'untrusted jku',
    function (t) {
      var jwk = JWK.fromPEM(
        keys.secret.pem,
        {
          alg: 'RS256',
          jku: base, // not on the trusted list
        }
      )

      var jwt = jwk.signSync({ foo: true })
      return r.postAsync(
        {
          url: publish,
          json: {
            events: [jwt]
          }
        }
      )
      .then(
        function (result) {
          t.equal(result[0].statusCode, 400)
          t.equal(result[1].message, 'untrusted')
        }
      )
    }
  )

  test(
    'unavailable jku',
    function (t) {
      var jwk = JWK.fromPEM(
        keys.secret.pem,
        {
          alg: 'RS256',
          jku: unavailableJKU
        }
      )

      var jwt = jwk.signSync({ foo: true })
      return r.postAsync(
        {
          url: publish,
          json: {
            events: [jwt]
          }
        }
      )
      .then(
        function (result) {
          t.equal(result[0].statusCode, 500)
        }
      )
    }
  )

  test(
    'bad jku',
    function (t) {
      var jwk = JWK.fromPEM(
        keys.secret.pem,
        {
          alg: 'RS256',
          jku: badJKU
        }
      )

      var jwt = jwk.signSync({ foo: true })
      return r.postAsync(
        {
          url: publish,
          json: {
            events: [jwt]
          }
        }
      )
      .then(
        function (result) {
          t.equal(result[0].statusCode, 400)
          t.equal(result[1].message, 'bad jku')
        }
      )
    }
  )

  test(
    'unknown kid',
    function (t) {
      var jwk = JWK.fromPEM(
        keys.secret.pem,
        {
          alg: keys.secret.jwk.alg,
          jku: keys.secret.jwk.jku,
          kid: 'wat'
        }
      )

      var jwt = jwk.signSync({ foo: true })
      return r.postAsync(
        {
          url: publish,
          json: {
            events: [jwt]
          }
        }
      )
      .then(
        function (result) {
          t.equal(result[0].statusCode, 400)
          t.equal(result[1].message, 'unknown kid')
        }
      )
    }
  )

  test(
    'malformed jwt',
    function (t) {
      var jwt = keys.secret.signSync({ foo: true }).replace('e', 'f')
      return r.postAsync(
        {
          url: publish,
          json: {
            events: [jwt]
          }
        }
      )
      .then(
        function (result) {
          t.equal(result[0].statusCode, 400)
          t.equal(result[1].message, 'malformed')
        }
      )
    }
  )

  test(
    'publish happy path',
    function (t) {
      var jwt = keys.secret.signSync({ foo: true })

      return r.postAsync(
        {
          url: publish,
          json: {
            events: [jwt, jwt]
          }
        }
      )
      .then(
        function (result) {
          var res = result[0]
          var data = result[1]
          t.equal(res.statusCode, 200)
          t.deepEqual(data, {})
          return r.getAsync(
            {
              url: events,
              headers: authHeaders,
              json: true
            }
          )
        }
      )
      .then(
        function (result) {
          var res = result[0]
          var data = result[1]
          t.equal(res.statusCode, 200)
          t.equal(data.next_pos, '2')
          t.equal(data.events[0], jwt)
          return r.getAsync(
            {
              url: events + '/head',
              headers: authHeaders,
              json: true
            }
          )
        }
      )
      .then(
        function (result) {
          var res = result[0]
          var data = result[1]
          t.equal(res.statusCode, 200)
          t.equal(data.pos, '2')
          return r.getAsync(
            {
              url: events + '/tail',
              headers: authHeaders,
              json: true
            }
          )
        }
      )
      .then(
        function (result) {
          var res = result[0]
          var data = result[1]
          t.equal(res.statusCode, 200)
          t.equal(data.pos, '0')
        }
      )
    }
  )

  test(
    'teardown',
    function (t) {
      return server.db.wipe()
        .then(server.stop.bind(server))
    }
  )
})
