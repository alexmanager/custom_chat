var request = require("request"),
    cheerio = require("cheerio"),
    Promise = require("promise"),
    path = require('path');

String.prototype.limit = function (limit, userParams) {
    var text, options, prop, lastSpace;

    text = this;
    options = {
        ending: '...', trim: true, words: true
    };

    if (limit !== parseInt(limit) || limit <= 0) return this;

    if (typeof userParams == 'object') {
        for (prop in userParams) {
            if (userParams.hasOwnProperty.call(userParams, prop)) {
                options[prop] = userParams[prop];
            }
        }
    }

    if (options.trim) text = text.trim();

    if (text.length <= limit) return text;

    text = text.slice(0, limit);
    lastSpace = text.lastIndexOf(" ");
    if (options.words && lastSpace > 0) {
        text = text.substr(0, lastSpace);
    }
    return text + options.ending;
};

module.exports = function (socket, chat, user) {
    var Plugin = function (socket) {
        this.socket = socket || null;
    };

    Plugin.prototype.callback = function (result) {
        var $, description, title, time, message, scope;

        /*function urlify(text) {
         var urlRegex = /(https?:\/\/[^\s]+)/g;
         return text.replace(urlRegex, function(url) {
         return '<a href="' + url + '">' + url + '</a>';
         });
         }*/

        //console.log(urlify(result.text));

        scope = this;
        this.message = '';

        result.data.forEach(function (item, i) {
            request(item, function (error, response, body) {
                if (!error) {
                    $ = cheerio.load(body);
                    description = $('meta[name=\'description\']').attr('content') || '';
                    title = $('title').text() || '';
                    time = new Date().getTime();
                    scope.message += chat.swig.renderFile(
                        path.join(__dirname, './message.html'),
                        {
                            url: result.data[0],
                            description: description.limit(100),
                            title: title
                        }
                    );

                    if (i === result.data.length - 1) {
                        setTimeout(function () {
                            chat.io.sockets.in(result.room).emit('message', {
                                type: 'text-message',
                                message: '<li class=\'msg\'>' +
                                    '<span class="time">(' + chat.wrapDate(time) + ')</span>' +
                                    '<span class="username">' + user.deserializeUser(result.user_id).name + ':</span>' +
                                    scope.message +
                                    '</li>',
                                text: scope.message,
                                user: user.deserializeUser(result.user_id),
                                time: time
                            });
                            
                            console.log('result', result);
                        }, 0);
                    }
                } else {
                    console.log("Error: " + error);
                }
            });
        });
    };

    return new Plugin(socket);
};