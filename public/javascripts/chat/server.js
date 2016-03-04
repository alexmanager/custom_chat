module.exports = function (app) {
    var socket_io, lib, time, rooms, chat, user, layout, swig, theme;
    swig = require('swig');
    theme = 'default';

    socket_io = require("socket.io");
    lib = require("./lib");

    app.io = socket_io();
    app.io.use(function (socket, next) {
        var config = socket.request;
        theme = config._query['theme'];
        next();
    });

    chat = new lib.Chat(swig, theme);
    user = new lib.User();

    app.io.sockets.on('connection', function (socket) {
        rooms = chat.getActiveRooms();
        time = new Date().getTime();
        layout = swig.renderFile(__dirname + '/themes/' + theme + '/index.html', {
            rooms: rooms
        });

        socket.emit('message', {
            type: 'system-data',
            action: 'send-layout',
            data: {layout: layout},
            time: time
        });

        socket.on('createRoom', function (data) {
            var message;

            chat.updateRoomsList('add-room', data.room);
            time = new Date().getTime();
            message = chat.prepareMessage({
                system: true,
                text: 'new room \'' + data.room + '\' created',
                username: false,
                time: time
            });

            app.io.emit('message', {
                type: 'update-rooms',
                message: message,
                rooms: chat.getActiveRooms(),
                time: time
            });
        });

        socket.on('joinRoom', function (data) {
            var message;

            socket.join(data.room);
            time = new Date().getTime();
            message = chat.prepareMessage({
                system: true,
                text: 'user \'' + data.user + '\' connected to \'' + data.room + '\' room',
                username: false,
                time: time
            });

            if (data.user && data.user !== '') {
                var id = user.serializeUser(user.signinUser({
                    name: data.user
                }));
            }

            socket.emit('message', {
                type: 'system-data',
                action: 'join-room',
                data: {id: id},
                time: time
            });

            app.io.to(data.room).emit('message', {
                type: 'system-message',
                message: message,
                time: time
            });
        });

        socket.on('leaveRoom', function (data) {
            var message, removedUser;

            removedUser = user.removeUser(data.user.id);
            time = new Date().getTime();
            message = chat.prepareMessage({
                system: true,
                text: 'user \'' + removedUser.name + '\' disconnected from \'' + data.room + '\' room',
                user: removedUser,
                time: time
            });

            socket.leave(data.room, function (err) {
            });

            socket.emit('message', {
                type: 'system-data',
                action: 'leave-room',
                data: removedUser,
                time: time
            });

            app.io.emit('message', {
                type: 'system-message',
                message: message,
                time: time
            });
        });

        socket.on('client-message', function (data) {
            var message;
            time = new Date().getTime();

            message = chat.prepareMessage({
                system: false,
                text: data.message,
                username: user.deserializeUser(data.user_id).name,
                time: time
            });

            app.io.sockets.in(data.room).emit('message', {
                type: 'text-message',
                message: message,
                user: user.deserializeUser(data.user_id),
                time: time
            });
        });
    });
};