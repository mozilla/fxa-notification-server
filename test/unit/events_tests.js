/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var test = require('../lib/ptaptest')
var qs = require('querystring')
var config = require('../../lib/config')
var TestServer = require('../lib/test_server')
var r = require('../../lib/prequest')

var keys = require('../../lib/keys')(config)
var base = 'http://' + config.server.host + ':' + config.server.port
var publish = base + '/v0/publish'
var events = base + '/v0/events'
var authHeaders = {
  'Authorization': 'Bearer foo-bar-notify'
}

var fooJWT = keys.secret.signSync(
  {
    uid: 'foo',
    rid: 'bar',
    typ: 'baz'
  }
)

function publishFoo(t) {
  return r.postAsync(
    {
      url: publish,
      json: {
        events: [fooJWT]
      }
    }
  )
  .then(
    function (result) {
      t.equal(result[0].statusCode, 200)
    }
  )
}

TestServer.start(config)
.then(function (server){

  test(
    'matching all filters',
    function (t) {
      return publishFoo(t)
      .then(
        function () {
          var filter = {
            uid: 'foo',
            rid: 'bar',
            typ: 'baz',
            iss: keys.secret.jwk.iss
          }
          return r.getAsync(
            {
              headers: authHeaders,
              url: events + '?' + qs.stringify(filter),
              json: true
            }
          )
          .then(
            function (result) {
              var data = result[1]
              t.equal(result[0].statusCode, 200)
              t.equal(data.next_pos, '1')
              t.equal(data.events[0], fooJWT)
              return server.db.wipe()
            }
          )
        }
      )
    }
  )

  test(
    'an unmatched filter',
    function (t) {
      return publishFoo(t)
      .then(
        function () {
          var filter = {
            uid: 'foo',
            rid: 'bar',
            typ: 'different',
            iss: keys.secret.jwk.iss
          }
          return r.getAsync(
            {
              headers: authHeaders,
              url: events + '?' + qs.stringify(filter),
              json: true
            }
          )
          .then(
            function (result) {
              var data = result[1]
              t.equal(result[0].statusCode, 200)
              t.equal(data.next_pos, '1')
              t.equal(data.events.length, 0)
              return server.db.wipe()
            }
          )
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
