/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var test = require('../lib/ptaptest')
var config = require('../../lib/config')
var TestServer = require('../lib/test_server')
var r = require('../../lib/prequest')
var P = require('../../lib/promise')

var keys = require('../../lib/keys')(config)
var base = 'http://' + config.server.host + ':' + config.server.port
var sub = base + '/v0/subscription/'
var authHeaders = {
  'Authorization': 'Bearer foo-bar-notify'
}

function createSub(t, ttl) {
  return r.postAsync(
    {
      url: base + '/v0/subscribe',
      headers: authHeaders,
      json: {
        notify_url: 'foo',
        ttl: ttl || 1
      }
    }
  )
  .then(
    function (result) {
      t.equal(result[0].statusCode, 200)
      t.equal(typeof(result[1].id), 'string')
      return result[1]
    }
  )
}

TestServer.start(config)
.then(function (server) {

  test(
    'subscribe/get/del',
    function (t) {
      return createSub(t)
      .then(
        function (data) {
          t.equal(typeof(data.id), 'string')
          return r.getAsync(
            {
              url: sub + data.id,
              headers: authHeaders,
              json: true
            }
          )
          .then(
            function (result) {
              var res2 = result[0]
              var data2 = result[1]
              t.equal(res2.statusCode, 200)
              t.deepEqual(
                data2,
                {
                  id: data.id,
                  notify_url: 'foo',
                  pos: '0',
                  filter: {},
                  ttl: 1
                }
              )
              return r.delAsync(
                {
                  url: sub + data.id,
                  headers: authHeaders,
                  json: true
                }
              )
            }
          )
          .then(
            function (result) {
              var res3 = result[0]
              var data3 = result[1]
              t.equal(res3.statusCode, 200)
              t.deepEqual(data3, {})
            }
          )
        }
      )
    }
  )

  test(
    'updating subscription',
    function (t) {
      return createSub(t)
      .then(
        function (data) {
          return r.postAsync(
            {
              url: sub + data.id,
              headers: authHeaders,
              json: {
                notify_url: 'bar',
                pos: '2'
              }
            }
          )
        }
      )
      .then(
        function (result) {
          t.equal(result[0].statusCode, 200)
          var data = result[1]
          t.equal(data.pos, '2')
          t.equal(data.notify_url, 'bar')
        }
      )
    }
  )

  test(
    'subscription events',
    function (t) {
      return createSub(t)
        .then(
          function (data) {
            return r.getAsync(
              {
                url: sub + data.id + '/events',
                headers: authHeaders,
                json: true
              }
            )
            .then(
              function (result) {
                t.equal(result[0].statusCode, 200)
                t.deepEqual(
                  result[1],
                  {
                    next_pos: '0',
                    events: []
                  }
                )
              }
            )
          }
        )
    }
  )

  test(
    'subscription events post',
    function (t) {
      return createSub(t)
        .then(
          function (data) {
            return r.postAsync(
              {
                url: sub + data.id + '/events',
                headers: authHeaders,
                json: {
                  pos: '1'
                }
              }
            )
            .then(
              function (result) {
                t.equal(result[0].statusCode, 200)
                t.deepEqual(
                  result[1],
                  {
                    next_pos: '1',
                    events: []
                  }
                )
                return r.getAsync(
                  {
                    url: sub + data.id,
                    headers: authHeaders,
                    json: true
                  }
                )
              }
            )
          }
        )
        .then(
          function (result) {
            t.equal(result[0].statusCode, 200)
            t.equal(result[1].pos, '1')
          }
        )
    }
  )

  test(
    'delete non existing sub',
    function (t) {
      return r.delAsync(
        {
          url: sub + 'wat',
          headers: authHeaders,
          json: true
        }
      )
      .then(
        function (result) {
          t.equal(result[0].statusCode, 200, 'sure whatever')
          t.deepEqual(result[1], {})
        }
      )
    }
  )

  test(
    'notify_url',
    function (t) {
      return createSub(t, 2)
      .then(
        function (data) {
          return r.postAsync(
            {
              url: base + '/v0/publish',
              json: {
                events: [keys.secret.signSync({ foo: true })]
              }
            }
          )
        }
      )
      .then(
        function (result) {
          // TODO: this test is incomplete because sending to notify_url
          // is incomplete. For now this just checks that the notify
          // and filter logic doesn't blow up. See the code coverage
          // to verify what is getting executed.
          t.equal(result[0].statusCode, 200)
        }
      )
    }
  )

  test(
    'expiring ttl',
    function (t) {
      return createSub(t)
      .then(
        function (data) {
          var id = data.id
          return r.getAsync(
            {
              url: sub + id,
              headers: authHeaders,
              json: true
            }
          )
          .then(
            function (result) {
              t.equal(result[0].statusCode, 200)
              t.equal(result[1].id, id, 'now you see me')
              var d = P.defer()
              setTimeout(function () { d.resolve(id) }, 1100)
              return d.promise
            }
          )
        }
      )
      .then(
        function (id) {
          return r.getAsync(
            {
              url: sub + id,
              headers: authHeaders,
              json: true
            }
          )
        }
      )
      .then(
        function (result) {
          t.equal(result[0].statusCode, 404, 'now you don\'t')
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
