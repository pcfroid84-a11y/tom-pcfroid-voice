import Fastify from "fastify";
import websocket from "@fastify/websocket";
import formbody from "@fastify/formbody";
import WebSocket from "ws";

const app = Fastify({ logger: true });

await app.register(formbody);
await app.register(websocket);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

const SYSTEM_PROMPT = `
Tu es Tom, l'assistant téléphonique de PC Froid.

Accueil obligatoire :
"Bonjour, PC Froid, Tom à l'appareil. Je vous écoute."

Règles générales :
- Parle toujours en français.
- Sois naturel, professionnel, chaleureux et concis.
- Laisse le client finir de parler avant de répondre.
- Analyse en priorité sa première phrase.
- Ne redemande jamais une information déjà donnée.
- Pose une seule question à la fois.
- N'invente jamais une information, un tarif, un rendez-vous ou une disponibilité.
- Si tu ne sais pas, dis que tu vas faire vérifier l'information.
- Pour l'instant, ton objectif est uniquement de mener une conversation téléphonique naturelle avec le client.
`;

app.get("/", async () => {
  return {
    status: "ok",
    service: "Tom PC Froid Voice",
  };
});

/*
  Twilio appelle cette URL au début de l'appel.
  On renvoie du TwiML qui ouvre un flux audio bidirectionnel
  vers notre WebSocket /media-stream.
*/
app.all("/incoming-call", async (request, reply) => {
  const host = request.headers.host;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/media-stream" />
  </Connect>
</Response>`;

  reply
    .type("text/xml")
    .send(twiml);
});

app.get("/media-stream", { websocket: true }, (connection) => {
  let streamSid = null;
  let openAiReady = false;
  let greetingSent = false;

  const openAiWs = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1-mini",
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    }
  );

  function sendToOpenAI(payload) {
    if (openAiWs.readyState === WebSocket.OPEN) {
      openAiWs.send(JSON.stringify(payload));
    }
  }

  function sendGreeting() {
    if (greetingSent || !openAiReady) return;

    greetingSent = true;

    sendToOpenAI({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        instructions:
          'Dis exactement : "Bonjour, PC Froid, Tom à l’appareil. Je vous écoute." Puis attends que le client parle.',
      },
    });
  }

  openAiWs.on("open", () => {
    app.log.info("Connexion OpenAI Realtime ouverte");

    sendToOpenAI({
      type: "session.update",
      session: {
        type: "realtime",
        model: "gpt-realtime-2.1-mini",
        output_modalities: ["audio"],
        instructions: SYSTEM_PROMPT,
        audio: {
          input: {
            format: {
              type: "audio/pcmu",
            },
            turn_detection: {
              type: "semantic_vad",
            },
          },
          output: {
            format: {
              type: "audio/pcmu",
            },
            voice: "marin",
          },
        },
      },
    });
  });

  openAiWs.on("message", (raw) => {
    try {
      const event = JSON.parse(raw.toString());

      if (event.type === "session.updated") {
        openAiReady = true;
        sendGreeting();
      }

      if (
        event.type === "response.output_audio.delta" &&
        streamSid &&
        connection.socket.readyState === WebSocket.OPEN
      ) {
        connection.socket.send(
          JSON.stringify({
            event: "media",
            streamSid,
            media: {
              payload: event.delta,
            },
          })
        );
      }

      if (event.type === "error") {
        app.log.error(
          { openaiError: event },
          "Erreur OpenAI Realtime"
        );
      }
    } catch (error) {
      app.log.error(error, "Erreur traitement message OpenAI");
    }
  });

  openAiWs.on("close", () => {
    app.log.info("Connexion OpenAI Realtime fermée");
  });

  openAiWs.on("error", (error) => {
    app.log.error(error, "Erreur WebSocket OpenAI");
  });

  connection.socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      switch (message.event) {
        case "start":
          streamSid = message.start.streamSid;
          app.log.info(
            { streamSid },
            "Flux Twilio démarré"
          );
          break;

        case "media":
          sendToOpenAI({
            type: "input_audio_buffer.append",
            audio: message.media.payload,
          });
          break;

        case "stop":
          app.log.info("Flux Twilio arrêté");

          if (openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.close();
          }
          break;

        default:
          break;
      }
    } catch (error) {
      app.log.error(error, "Erreur traitement message Twilio");
    }
  });

  connection.socket.on("close", () => {
    app.log.info("Connexion Twilio fermée");

    if (openAiWs.readyState === WebSocket.OPEN) {
      openAiWs.close();
    }
  });
});

try {
  await app.listen({
    port: PORT,
    host: "0.0.0.0",
  });

  app.log.info(`Tom Voice écoute sur le port ${PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
