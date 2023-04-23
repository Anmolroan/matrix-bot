const fastify = require("fastify")();
const sdk = require("matrix-js-sdk");
const dotenv = require('dotenv');
const websocket = require("fastify-websocket");
dotenv.config();
const homeserverUrl = process.env.HOME_SERVER_URL;
const accessToken =process.env.ACCESS_TOKEN;
const roomId = process.env.ROOM_ID;



const matrixClient = sdk.createClient({
  baseUrl: homeserverUrl,
  accessToken: accessToken,
  userId: "@anmolroan:matrix.org",
  timelineSupport: true,
});
matrixClient.startClient();



matrixClient.on('sync', (state, prevState, data) => {
  if (state === 'PREPARED') {
    console.log('Matrix client synced and ready to receive messages');
  }
});

matrixClient.on('Room.timeline', (event, room, toStartOfTimeline, removed, data) => {
  if (room.roomId === roomId && event.getType() === 'm.room.message') {
    const messageData = {
      sender: event.getSender(),
      body: event.getContent().body
    };
    console.log(messageData);
    // Broadcast the message to all connected clients
    fastify.websocketServer.clients.forEach((client) => {
      client.send(JSON.stringify(messageData));
    });
  }
});

fastify.register(websocket);


// to get all rooms with id
fastify.get("/getRooms", async (request, reply) => {

  const rooms =matrixClient.getRooms();
const roomObj=  matrixClient.getRooms().map(room => {
      return(`Room name: ${room.name}, Room ID: ${room.roomId}`);
    });
    reply.send(roomObj)
})


// to get real time messages
fastify.get('/messages/real-time', { websocket: true }, (connection, req) => {
  console.log('New websocket connection');
  // Add the new client to the clients array
  fastify.websocketServer.clients.add(connection.socket);

  connection.socket.on('close', () => {
    console.log('Websocket connection closed');
    // Remove the client from the clients array
    fastify.websocketServer.clients.delete(connection.socket);
  });
});

fastify.get("/messages", async (request, reply) => {
    console.log(process.env.accessToken)
  const room = matrixClient.getRoom(roomId);
  if (!room) {
    return reply.code(404).send({ error: "Room not found" });
  }

  // Fetch the room timeline
  const response = await matrixClient.scrollback(room);

  // Extract the events from the timeline
  const events = response.timeline;

  // Filter the events to include only messages
  const messages = events.filter(
    (event) => event.getType() === "m.room.message"
  );

  matrixClient.on(
    "Room.timeline",
    (event, room, toStartOfTimeline, removed, data) => {
      if (room.roomId === roomId && event.getType() === "m.room.message") {
        const messageData = {
          sender: event.getSender(),
          body: event.getContent().body,
          timestamp: event.getOriginServerTs(),
        };
      }
    }
  );
  const messageData = messages.map((event) => {
    const message = {
      sender: event.getSender(),
      body: event.getContent().body,
    };
    return message;
  });

  reply.send(JSON.stringify(messageData, undefined, 2));
});



fastify.listen(3000, (err) => {
  if (err) {
    console.log(err);
    process.exit(1);
  }
  console.log('Server listening on port 3000');
  matrixClient.startClient();
});







