const express = require("express");
const cors = require('cors');
const http = require('http');
const socketIo = require("socket.io");

const index = require("./routes/index");
const port = process.env.PORT || 8081;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

var app = express();

app.use(cors());

app.get('/turn', function (req, res, next) {
    client.tokens.create().then(token => res.send(token)).catch(e => res.send('bad'));
});

app.use('/', index);

const server = http.createServer(app);

const io = socketIo(server);

var sockets = {};
var channels = {};

io.on("connection", (socket) => {
    socket.channels = {};
    console.log(`Client connected. Socket Id: ${socket.id}`);
    sockets[socket.id] = socket;

    socket.on('join_channel', (config) => {
        console.log(`Received. Join Channel`);
        var channel = config.channel;

        if (channel in socket.channels){
            // already joined
            return;
        }

        if (!(channel in channels)){
            channels[channel] = {};
        }
        
        for (id in channels[channel]){
            console.log(`Sending begin_peer_connection - ${id} to ${socket.id} `);
            channels[channel][id].emit('begin_peer_connection', {'peer_socket_id': socket.id, 'should_create_offer' : false});
            socket.emit('begin_peer_connection', {'peer_socket_id':id, 'should_create_offer' : true});
        }

        channels[channel][socket.id] = socket;
        socket.channels[channel] = channel;
    });

    socket.on('trxICECandidate', (config) => {
        console.log(`Received - Transfer ICE Candidate `)
        var peer_socket_id = config.peer_socket_id;
        var ice_candidate = config.ice_candidate;

        if(!(peer_socket_id in sockets)){
            console.log(`ERROR: Attempted to relay ICE candidate to non-existant socket. SocketID ${peer_socket_id}`);
            return;
        }
        
        console.log(`Sending ICE Candidate to ${peer_socket_id}`)
        sockets[peer_socket_id].emit('iceCandidate', {'peer_socket_id': socket.id, 'ice_candidate': ice_candidate});
    });

    socket.on('relaySessionDescription', (config) => {
        var peer_socket_id = config.peer_socket_id;
        var session_description = config.session_description;

        if(!(peer_socket_id in sockets)){
            console.log(`ERROR: Attempted to relay session description to non-existant socket. SocketID ${peer_socket_id}`);
            return;
        }

        console.log(`Sending Session Description to ${peer_socket_id}`)
        sockets[peer_socket_id].emit('sessionDescription', {'peer_socket_id': socket.id, 'session_description': session_description});
    });

    socket.on('disconnect', function () {
        console.log(`Client disconnected. Socket Id: ${socket.id}`);
        for (var channel in socket.channels) {

            delete socket.channels[channel];
            delete channels[channel][socket.id];

            for (id in channels[channel]){
                console.log(`Emitting removePeer message to ${id}`);
                channels[channel][id].emit('removePeer', { 'peer_id' : socket.id});
                socket.emit('removePeer', {'peer_id': id});
            }
        }

        delete sockets[socket.id];
    });
})

server.listen(port, () => console.log(`Express App running on port ${port}`));