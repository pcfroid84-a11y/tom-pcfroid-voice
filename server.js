import Fastify from "fastify";
import websocket from "@fastify/websocket";
import formbody from "@fastify/formbody";
import WebSocket from "ws";

const app = Fastify({ logger: true });

await app.register(formbody);
await app.register(websocket);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK_URL =
  "https://pcfroid84.app.n8n.cloud/webhook/tom-appel";

const SYSTEM_PROMPT = `
Tu es Tom, l'assistant téléphonique de PC Froid.

Règles de conversation :
- Parle toujours en français.
- Sois naturel, professionnel, chaleureux et très concis.
- Ne te présente pas et ne répète jamais "Bonjour, PC Froid, Tom à l'appareil" pendant la conversation. L'accueil est géré séparément au début de l'appel.
- Laisse le client finir de parler avant de répondre.
- Écoute en priorité la première phrase du client : elle contient souvent la raison de l'appel.
- Ne répète pas inutilement ce que le client vient de dire.
- N'utilise pas automatiquement "merci", "d'accord", "très bien", "parfait" ou une formule équivalente après chaque réponse du client.
- Ne remercie pas le client simplement parce qu'il répond à une question ou donne une information.
- Évite de répéter une même formule de politesse ou de transition pendant l'appel.
- Après une réponse simple du client, enchaîne directement sur la question ou l'action utile suivante.
- Il est parfaitement naturel de répondre sans aucune formule de transition.
- Ne répète jamais une phrase déjà utilisée dans les deux échanges précédents, sauf si le client demande de la répéter.
- Pose une seule question à la fois.
- Pour une panne simple, pose au maximum 2 questions techniques utiles.
- Ne pose une question que si la réponse est réellement utile pour décider de la suite.
- Dès que tu as suffisamment d'informations, arrête les questions et conclus.
- Ne transforme jamais l'appel en interrogatoire.
- Si le client semble pressé, agacé ou répond très brièvement, arrête de questionner et passe à la conclusion.
- N'invente jamais une information, un tarif, un rendez-vous ou une disponibilité.
- Si tu ne sais pas, dis simplement que tu vas faire transmettre l'information à Christophe.
- Identification du client : utilise en priorité le numéro entrant et la fiche contact. Si une seule personne correspond clairement, utilise son prénom sans redemander son identité. Si plusieurs personnes peuvent utiliser le même numéro ou si l'identité est incertaine, demande une seule confirmation courte puis ne redemande plus.
- Ne demande jamais au client de faire lui-même un diagnostic technique ou de distinguer des éléments techniques qu'il n'est pas censé connaître.
- Pars d'abord du symptôme le plus probable et demande une confirmation simple. Exemple : "Vous avez de l'eau qui coule de l'unité intérieure, c'est bien ça ?" plutôt que "Est-ce de l'eau ou du liquide réfrigérant ?"
- Le client décrit ce qu'il voit, entend ou ressent. C'est à toi d'interpréter techniquement ses réponses.
- Dès que les informations indispensables sont obtenues, arrête de poser des questions.
- Pour terminer l'appel : fais un récapitulatif très court du problème, annonce clairement l'action suivante, salue le client puis mets fin à la conversation.

Compréhension du français parlé :
- Les clients parlent naturellement et omettent souvent le mot "ne".
- "Ma clim fait plus de froid", "j'ai plus de froid" ou "elle fait plus de froid" signifie généralement que la climatisation NE FAIT PLUS de froid.
- "Elle fait plus de chaud" ou "j'ai plus de chauffage" signifie généralement qu'elle NE FAIT PLUS de chaud.
- Ne comprends "plus" comme "davantage" que si le contexte l'indique clairement.
- En cas de véritable ambiguïté, demande une confirmation courte.

Comportement attendu :
- Cherche d'abord à comprendre simplement le motif de l'appel.
- Pour un problème technique, recueille uniquement les informations indispensables.
- Si le problème nécessite une intervention ou si tu n'es pas certain, propose de transmettre à Christophe.
- Une conversation courte et efficace est préférable à une longue conversation.
- Ton objectif est que le client ait l'impression de parler à un assistant compétent de PC Froid, pas à un questionnaire automatique.
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

app.get("/media-stream", { websocket: true }, (socket) => {
  let streamSid = null;
  let openAiReady = false;
  let greetingSent = false;
  let n8nContextLoaded = false;
  let n8nContextLoading = false;

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
  function isUsefulCallerMessage(text) {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:]/g, "");

  if (normalized.length < 8) return false;

  const trivialMessages = [
    "bonjour",
    "allo",
    "salut",
    "oui",
    "non",
    "ok",
    "d'accord",
    "daccord",
    "merci"
  ];

  return !trivialMessages.includes(normalized);
}

async function loadN8nContext(callerMessage) {
  if (n8nContextLoaded || n8nContextLoading) return;
  if (!isUsefulCallerMessage(callerMessage)) return;

  n8nContextLoading = true;

  try {
    app.log.info(
      { callerMessage },
      "Envoi de la demande au cerveau n8n"
    );

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        caller_message: callerMessage
      })
    });

    if (!response.ok) {
      throw new Error(`n8n HTTP ${response.status}`);
    }

    const context = await response.json();

    const rules = (context.essential_rules || [])
      .map(rule => `- ${rule.instruction}`)
      .join("\n");

    const scenarios = (context.selected_scenarios || [])
      .map(s => `
Scénario : ${s.scenario || ""}
Compréhension : ${s.expected_understanding || ""}
Questions maximum : ${s.max_questions || ""}
Action : ${s.expected_action || ""}
Urgence : ${s.urgency_level || ""}
`)
      .join("\n");

    const procedures = (context.selected_procedures || [])
      .map(p => `
Procédure : ${p.name || ""}
Étapes autorisées : ${p.allowed_steps || ""}
Limites de sécurité : ${p.safety_limits || ""}
`)
      .join("\n");

    const businessContext = `
CONTEXTE MÉTIER PC FROID POUR CET APPEL

Catégorie : ${context.routing?.category || ""}
Urgence : ${context.routing?.urgency || 0}
Analyse : ${context.routing?.reason || ""}

RÈGLES UTILES :
${rules}

SCÉNARIO :
${scenarios}

PROCÉDURE :
${procedures}

Utilise ce contexte pour la suite de l'appel.
Ne récite pas ce contenu au client.
Reste naturel et concis.
`;

    sendToOpenAI({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [
          {
            type: "input_text",
            text: businessContext
          }
        ]
      }
    });

    n8nContextLoaded = true;

    app.log.info(
      {
        category: context.routing?.category,
        urgency: context.routing?.urgency
      },
      "Contexte n8n injecté dans Tom"
    );

  } catch (error) {
    app.log.error(error, "Erreur récupération contexte n8n");
  } finally {
    n8nContextLoading = false;
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
               transcription: {
      model: "gpt-4o-mini-transcribe",
      language: "fr"
    },
            turn_detection: {
              type: "semantic_vad",
            },
          },
          output: {
            format: {
              type: "audio/pcmu",
            },
            voice: "cedar",
          },
        },
      },
    });
  });

  openAiWs.on("message", (raw) => {
    try {
      const event = JSON.parse(raw.toString());
      if (
  event.type ===
  "conversation.item.input_audio_transcription.completed"
) {
  const callerMessage = event.transcript?.trim();

  if (callerMessage) {
    app.log.info(
      { callerMessage },
      "Transcription client reçue"
    );
    loadN8nContext(callerMessage);
  }
}

      if (event.type === "session.updated") {
        openAiReady = true;
        sendGreeting();
      }

      if (
        event.type === "response.output_audio.delta" &&
        streamSid &&
        socket.readyState === WebSocket.OPEN
      ) {
        socket.send(
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

  socket.on("message", (raw) => {
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

  socket.on("close", () => {
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
