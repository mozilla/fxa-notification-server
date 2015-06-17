/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var uuid = require('uuid')
var Filter = require('./filter')
var P = require('./promise')

function Subscription(options) {
  this.id = options.id || uuid.v4()
  this.notify_url = options.notify_url
  this.pos = options.pos || '0'
  this.filter = new Filter(options.filter)
  this.ttl = options.ttl || 60 * 60 * 24
}

Subscription.parse = function (str) {
  return new Subscription(JSON.parse(str))
}

Subscription.prototype.test = function (jwt) {
  return this.filter.testJWT(jwt)
}

Subscription.prototype.notify = function () {
  // TODO
  return P.resolve()
}

function Subs(db) {
  this.db = db
}

Subs.prototype.create = function (options) {
  return this.set(new Subscription(options))
}

Subs.prototype.del = function (id) {
  return this.db.delSub(id)
}

Subs.prototype.get = function (id) {
  return this.db.getSub(id)
    .then(
      function (str) {
        return Subscription.parse(str)
      }
    )
}

Subs.prototype.set = function (sub) {
  return this.db.setSub(sub.id, JSON.stringify(sub), sub.ttl)
    .then(
      function () {
        return sub
      }
    )
}

Subs.prototype.notify = function (jwts) {
  return this.db.getAllSubs()
    .then(
      function (strs) {
        return strs.map(function (str) { return Subscription.parse(str) })
      }
    )
    .then(
      function (subs) {
        var active = {}
        for (var i = 0; i < subs.length; i++) {
          var sub = subs[i]
          for (var j = 0; j < jwts.length; j++) {
            if (sub.test(jwts[j])) {
              active[sub.id] = sub
            }
          }
        }
        return P.all(
          Object.keys(active).map(
            function (id) {
              return active[id].notify()
            }
          )
        )
      }
    )
    .then(
      function (all) {
        return true
      }
    )
}

module.exports = function (db) {
  return new Subs(db)
}
