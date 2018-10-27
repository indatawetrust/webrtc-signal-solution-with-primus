#!/usr/bin/env node

/**
 * Module dependencies.
 */

var app = require('../app');
var debug = require('debug')('primus-simple-peer:server');
var http = require('http');

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '7000');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);

var Primus = require('primus')

var Rooms = require('primus-rooms');

var primus = new Primus(server)
  , Socket = primus.Socket;

primus.plugin('rooms', Rooms);

let roomUsers = {}
let signals = {}

const getSignals = (users = []) => {
  return users.map(id => signals[id]).filter(s => s)
}

primus.on('joinroom', function (room, spark) {
  if (!roomUsers[room]) roomUsers[room] = []

  if (roomUsers[room].length < 2)
    roomUsers[room].push(spark.id)

  primus.room(room).write({
    action: 'users',
    data: roomUsers[room] || [],
    signal: getSignals(roomUsers[room])
  })
})

primus.on('leaveroom', function (room, spark) {
  if (!roomUsers[room]) roomUsers[room] = []

  roomUsers[room].splice(roomUsers[room].indexOf(spark.id), 1)
})

primus.on('connection', (spark) => {

  spark.on('data', (data) => {

    data = data || {};
    var action = data.action;
    var room = data.room;

    if ('join' === action) {
      spark.join(room)
    }

    if ('leave' === action) {
      spark.leave(room, function () {
        // ...
      });
    }

    if ('offerSignal' == action) {
      signals[spark.id] = data.signal

      primus.room(room).write({
        action: 'offerSignal',
        signal: data.signal
      })
    }

    if ('answerSignal' == action) {
      signals[spark.id] = data.signal

      primus.room(room).write({
        action: 'answerSignal',
        signal: data.signal
      })
    }

  });
});

primus.on('disconnection', function (spark) {
  delete signals[spark.id]

  for (let room in roomUsers) {
    if (roomUsers[room].indexOf(spark.id) > -1) {
      roomUsers[room].splice(roomUsers[room].indexOf(spark.id), 1)

      spark.leave(room)
    }

    primus.room(room).write({
      action: 'destroy'
    })
  }
});

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
