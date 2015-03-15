/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var subscriptions = {}

function Subscription(options) {
  this.id = Math.floor(Math.random() * 1000000000).toString()
  this.notify_url = options.notify_url
  this.pos = options.pos || '0'
  this.filter = options.filter || {}
  this.setTTL(options.ttl || 60 * 60 * 24)
}

Subscription.prototype.interestedIn = function (event) {
  var filterNames = Object.keys(this.filter)
  for (var i = 0; i < filterNames.length; i++) {
    var name = filterNames[i]
    if (event[name] && event[name] === this.filter[name]) {
      continue
    }
    else {
      return false
    }
  }
  return true
}

Subscription.prototype.setTTL = function (ttl) {
  this.ttl = ttl
  clearTimeout(this.timeout)
  if (ttl === 0) {
    delete subscriptions[this.id]
  }
  else {
    this.timeout = setTimeout(this.setTTL.bind(this, 0), this.ttl * 1000)
  }
}

Subscription.prototype.toJSON = function () {
  return {
    id: this.id,
    notify_url: this.notify_url,
    pos: this.pos,
    filter: this.filter,
    ttl: this.ttl
  }
}

module.exports = {
  whoToNotify: function (event) {
    var interested = {}
    var ids = Object.keys(subscriptions)
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i]
      var sub = subscriptions[id]
      if (sub.interestedIn(event)) {
        interested[sub.notify_url] = true
      }
    }
    return Object.keys(interested)
  },
  add: function (options) {
    var sub = new Subscription(options)
    subscriptions[sub.id] = sub
    return sub
  },
  remove: function (id) {
    var sub = subscriptions[id]
    if (sub) { sub.setTTL(0) }
  },
  get: function (id) {
    return subscriptions[id]
  }
}
