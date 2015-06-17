/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var P = require('../promise')
var boom = require('boom')

function MemDB() {
  this.db = []
  this.subs = {}
}

MemDB.prototype.start = function () {
  return P.resolve()
}

MemDB.prototype.stop = function () {
  return P.resolve()
}

MemDB.prototype.append = function (str) {
  this.db.push(str)
  return P.resolve((this.db.length - 1).toString())
}

MemDB.prototype.read = function (pos, num, filter) {
  pos = +pos || 0
  var events = []
  while (events.length < num && pos < this.db.length) {
    var str = this.db[pos]
    if (filter.test(str)) {
      events.push(str)
    }
    pos++
  }
  return P.resolve({
    next_pos: pos.toString(),
    events: events
  })
}

MemDB.prototype.head = function () {
  return P.resolve(this.db.length.toString())
}

MemDB.prototype.tail = function () {
  return P.resolve('0')
}

MemDB.prototype.setSub = function (key, value, ttl) {
  var s = this.subs[key]
  if (s) {
    clearTimeout(s.timer)
  }
  this.subs[key] = {
    value: value,
    timer: setTimeout(
      function () {
        delete this.subs[key]
      }.bind(this),
      ttl * 1000
    )
  }
  return P.resolve()
}

MemDB.prototype.getSub = function (key) {
  var s = this.subs[key]
  return s ? P.resolve(s.value) : P.reject(boom.notFound(key))
}

MemDB.prototype.delSub = function (key) {
  var s = this.subs[key]
  if (s) {
    clearTimeout(s.timer)
  }
  delete this.subs[key]
  return P.resolve()
}

MemDB.prototype.getAllSubs = function () {
  return P.resolve(
    Object.keys(this.subs).map(
      function (id) {
        return this.subs[id].value
      }.bind(this)
    )
  )
}

MemDB.prototype.wipe = function () {
  this.db = []
  return P.resolve()
}

module.exports = MemDB
