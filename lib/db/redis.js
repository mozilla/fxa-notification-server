/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var redis = require('redis')
var P = require('../promise')
var boom = require('boom')

function defer(d) {
  return function (err, data) {
    /* istanbul ignore next */
    return err ? d.reject(err) : d.resolve(data)
  }
}

function RedisDB(options) {
  this.options = options
  this.db = null
}

RedisDB.prototype.start = function () {
  var d = P.defer()
  this.db = redis.createClient(this.options.port, this.options.host)
  this.db.once('ready', function () { d.resolve() })
  return d.promise
}

RedisDB.prototype.stop = function () {
  var d = P.defer()
  this.db.quit(defer(d))
  return d.promise
}

RedisDB.prototype.append = function (str) {
  var d = P.defer()
  this.db.rpush(this.options.keyPrefix, str, defer(d))
  return d.promise
}

RedisDB.prototype.read = function (pos, num, filter) {
  pos = +pos || 0
  var d = P.defer()
  var matchFilter = filter.test.bind(filter)
  this.db.lrange(this.options.keyPrefix, pos, (pos + num - 1), defer(d))
  return d.promise.then(
    function (results) {
      return {
        next_pos: (pos + results.length).toString(),
        events: results.filter(matchFilter)
      }
    }
  )
}

RedisDB.prototype.head = function () {
  var d = P.defer()
  this.db.llen(this.options.keyPrefix, defer(d))
  return d.promise.then(function (len) { return len.toString() })
}

RedisDB.prototype.tail = function () {
  return P.resolve('0')
}

RedisDB.prototype.setSub = function (key, value, ttl) {
  var d = P.defer()
  this.db.setex(this.options.keyPrefix + '_s_' + key, ttl, value, defer(d))
  return d.promise
}

RedisDB.prototype.getSub = function (key) {
  var d = P.defer()
  this.db.get(this.options.keyPrefix + '_s_' + key, defer(d))
  return d.promise.then(
      function (str) {
        if (!str) { throw boom.notFound(key) }
        return str
      }
    )
}

RedisDB.prototype.delSub = function (key) {
  var d = P.defer()
  this.db.del(this.options.keyPrefix + '_s_' + key, defer(d))
  return d.promise
}

RedisDB.prototype.getAllSubs = function () {
  var d = P.defer()
  this.db.keys(
    this.options.keyPrefix + '_s_*',
    function (err, results) {
      /* istanbul ignore if */
      if (err) { return d.reject(err) }
      if (results.length === 0) { return d.resolve(results) }
      this.db.mget(results, defer(d))
    }.bind(this)
  )
  return d.promise.then(
    function (results) {
      return results.filter(function (x) { return !!x })
    }
  )
}

RedisDB.prototype.wipe = function () {
  var d = P.defer()
  this.db.flushall(defer(d))
  return d.promise
}

module.exports = RedisDB
