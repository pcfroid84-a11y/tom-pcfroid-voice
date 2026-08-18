import Fastify from "fastify";
import websocket from "@fastify/websocket";
import formbody from "@fastify/formbody";
import WebSocket from "ws";
 
const app = Fastify({ logger: true });
 
await app.register(formbody);
await app.register(websocket);
 
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = Number(process.env.PORT || 3000);
const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  "https://pcfroid84.app.n8n.cloud/webhook/tom-appel";
 
const REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1-mini";
const TRANSCRIBE_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
 
if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY manquante");
}
 
const SYSTEM_PROMPT = `
Tu es Tom, l'assistant téléphonique de PC Froid.
 
MISSION
- Comprendre rapidement le motif de l'appel.
- Identifier correctement l'appelant avant la fin de l'appel, sauf si le système t'indique explicitement que l'identité est déjà confirmée.
- Poser seulement les questions qui changent réellement la décision.
- Transmettre à Christophe dès qu'une intervention, une validation technique ou une décision humaine est nécessaire.
 
STYLE ORAL
- Parle toujours en français, avec des phrases courtes et naturelles.
- Une idée par phrase. Une question à la fois.
- Ne répète pas ce que le client vient de dire sauf pour confirmer une ambiguïté importante.
- N'enchaîne pas "merci", "d'accord", "très bien", "parfait". Une transition n'est pas obligatoire.
- Ne remercie pas le client simplement parce qu'il donne son nom, sa ville, sa marque ou répond à une question.
- Ne répète pas une formule déjà utilisée récemment.
- Ne te représente jamais pendant l'appel : l'accueil initial est géré séparément.
 
CONDUITE DE L'APPEL
1. Laisse d'abord le client expliquer son motif.
2. Pour une panne simple, pose au maximum deux questions techniques utiles.
3. Le client décrit ce qu'il voit, entend ou ressent ; ne lui demande pas de faire un diagnostic technique.
4. Pars de l'explication visible la plus probable et confirme simplement. Exemple : "Vous avez de l'eau qui coule de l'unité intérieure, c'est bien ça ?"
5. Dès que tu as assez d'informations, arrête les questions.
6. Avant toute formule de fin, vérifie que l'identité est connue. Si le système ne t'a pas confirmé l'identité, demande simplement le nom et le prénom.
7. Termine par un résumé très court, l'action suivante, puis une seule formule de politesse.
 
LIMITES
- N'invente jamais une information, un tarif, un rendez-vous, une disponibilité ou un diagnostic.
- Ne demande jamais au client d'ouvrir un appareil, de mesurer une tension ou de manipuler un circuit frigorifique.
- Si tu ne sais pas, dis simplement que Christophe vérifiera ou reprendra la demande.
- Si le client est pressé ou agacé, réduis encore les questions.
 
FRANÇAIS PARLÉ
- Les clients omettent souvent "ne".
- "Elle fait plus de froid" ou "j'ai plus de froid" signifie généralement "elle ne fait plus de froid".
- "Elle fait plus de chaud" ou "j'ai plus de chauffage" signifie généralement "elle ne chauffe plus".
- Si le sens reste réellement ambigu, pose une seule question courte de confirmation.
 
OBJECTIF
Le client doit avoir l'impression de parler à un assistant PC Froid compétent, simple et efficace, jamais à un questionnaire automatique.
`;
 
const GREETINGS = [
  "PC Froid bonjour, ici Tom. Que puis-je faire pour vous ?",
  "PC Froid bonjour, Tom à l'appareil. Comment puis-je vous aider ?",
  "Bonjour, PC Froid, ici Tom. Que puis-je faire pour vous ?",
];
 
const FILLER_MESSAGES = new Set([
  "bonjour",
  "allo",
  "salut",
  "oui",
  "non",
  "ok",
  "d'accord",
  "daccord",
  "merci",
  "je sais pas",
  "je ne sais pas",
  "ça marche pas",
  "ca marche pas",
  "eh oui ça marche pas",
  "eh oui ca marche pas",
  "ça fait bip",
  "ca fait bip",
  "je comprends rien",
  "je comprends rien moi",
]);
 
const BUSINESS_HINTS = [
  "clim",
  "climatisation",
  "chaud",
  "chauffage",
  "froid",
  "souffle",
  "fuite",
  "eau",
  "bruit",
  "bip",
  "voyant",
  "code",
  "télécommande",
  "telecommande",
  "mitsubishi",
  "heiwa",
  "daikin",
  "panasonic",
  "airzone",
  "pompe à chaleur",
  "pac",
  "entretien",
  "dépannage",
  "depannage",
  "devis",
  "facture",
  "attestation",
  "commande",
  "fournisseur",
  "chambre froide",
  "banque froide",
];
 
const NON_NAME_WORDS = new Set([
  "oui",
  "non",
  "ok",
  "merci",
  "bonjour",
  "allo",
  "clim",
  "climatisation",
  "froid",
  "chaud",
  "chauffage",
  "fuite",
  "eau",
  "bruit",
  "bip",
  "voyant",
  "code",
  "mitsubishi",
  "heiwa",
  "daikin",
  "panasonic",
  "airzone",
]);
 
function normalizeText(text = "") {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:]+/g, "")
    .replace(/\s+/g, " ");
}
 
function xmlEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
 
function maskPhone(phone) {
  if (!phone) return null;
  const value = String(phone);
  if (value.length <= 4) return "****";
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}
 
function isUsefulCallerMessage(text) {
  const normalized = normalizeText(text);
  if (!normalized || FILLER_MESSAGES.has(normalized)) return false;
 
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 4) return false;
 
  const hasBusinessHint = BUSINESS_HINTS.some((hint) =>
    normalized.includes(hint)
  );
 
  // Une phrase métier courte est utile ; sinon on demande un peu plus de matière.
  return hasBusinessHint || words.length >= 6;
}
 
function extractNameCandidate(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
 
  const strongPatterns = [
    /^(?:je m['’]appelle|moi c['’]est|mon nom c['’]est|je suis)\s+(.+)$/i,
    /^(?:c['’]est)\s+([\p{L}'’ -]{2,50})$/iu,
  ];
 
  let candidate = null;
  for (const pattern of strongPatterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      candidate = match[1].trim();
      break;
    }
  }
 
  // Quand Tom vient explicitement de demander le nom, une réponse courte peut être un nom.
  if (!candidate) candidate = raw;
 
  candidate = candidate
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
 
  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 4) return null;
  if (candidate.length < 2 || candidate.length > 60) return null;
  if (!words.every((word) => /^[\p{L}'’ -]+$/u.test(word))) return null;
 
  const normalizedWords = words.map((word) => normalizeText(word));
  if (normalizedWords.some((word) => NON_NAME_WORDS.has(word))) return null;
 
  const normalizedCandidate = normalizeText(candidate);
  if (FILLER_MESSAGES.has(normalizedCandidate)) return null;
  if (BUSINESS_HINTS.some((hint) => normalizedCandidate.includes(hint))) {
    return null;
  }
 
  return candidate;
}
 
function assistantAskedForIdentity(text) {
  const normalized = normalizeText(text);
  return [
    "votre nom",
    "nom et prénom",
    "nom et prenom",
    "comment vous appelez",
    "vous appelez comment",
    "pouvez-vous me donner votre nom",
    "pouvez vous me donner votre nom",
    "à quel nom",
    "a quel nom",
  ].some((phrase) => normalized.includes(phrase));
}
 
function assistantIsClosing(text) {
  const normalized = normalizeText(text);
  return /(?:bonne journée(?: à vous)?|bonne soirée(?: à vous)?|au revoir|à bientôt)$/.test(
    normalized
  );
}
 
function buildBusinessContext(context) {
  const rules = (context.essential_rules || [])
    .map((rule) => `- ${rule.instruction}`)
    .filter(Boolean)
    .join("\n");
 
  const scenarios = (context.selected_scenarios || [])
    .map(
      (scenario) => `
Scénario : ${scenario.scenario || ""}
Compréhension : ${scenario.expected_understanding || ""}
Questions maximum : ${scenario.max_questions || ""}
Action : ${scenario.expected_action || ""}
Urgence : ${scenario.urgency_level || ""}`
    )
    .join("\n");
 
  const procedures = (context.selected_procedures || [])
    .map(
      (procedure) => `
Procédure : ${procedure.name || ""}
Étapes autorisées : ${procedure.allowed_steps || ""}
Limites de sécurité : ${procedure.safety_limits || ""}`
    )
    .join("\n");
 
  return `
CONTEXTE MÉTIER PC FROID POUR CET APPEL
Catégorie : ${context.routing?.category || ""}
Urgence : ${context.routing?.urgency || 0}
Analyse : ${context.routing?.reason || ""}
 
RÈGLES UTILES
${rules}
 
SCÉNARIO RETENU
${scenarios}
 
PROCÉDURE ÉVENTUELLE
${procedures}
 
Consignes : utilise ce contexte sans le réciter. Reste concis. Respecte le nombre maximal de questions. Si la procédure n'est pas adaptée au symptôme réel, ne l'applique pas mécaniquement et passe à Christophe.
`;
}
 
app.get("/", async () => ({
  status: "ok",
  service: "Tom PC Froid Voice",
}));
 
app.all("/incoming-call", async (request, reply) => {
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const callerPhone = xmlEscape(request.body?.From || "");
  const calledPhone = xmlEscape(request.body?.To || "");
 
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/media-stream">
      <Parameter name="callerPhone" value="${callerPhone}" />
      <Parameter name="calledPhone" value="${calledPhone}" />
    </Stream>
  </Connect>
  <Hangup/>
</Response>`;
 
  reply.type("text/xml").send(twiml);
});
 
app.get("/media-stream", { websocket: true }, (socket) => {
  const state = {
    streamSid: null,
    callSid: null,
    callerPhone: null,
    calledPhone: null,
    openAiReady: false,
    greetingSent: false,
    assistantSpeaking: false,
    responseHadAudio: false,
    playbackMark: null,
    n8nLoading: false,
    n8nLoaded: false,
    n8nAttempts: 0,
    identityKnown: false,
    identityName: null,
    awaitingIdentity: false,
    identityRecoveryNeeded: false,
    pendingHangup: false,
    hangupMark: null,
    hangupFallback: null,
    closed: false,
  };
 
  const openAiWs = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(REALTIME_MODEL)}`,
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    }
  );
 
  function sendToOpenAI(payload) {
    if (openAiWs.readyState === WebSocket.OPEN) {
      openAiWs.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }
 
  function sendToTwilio(payload) {
    if (socket.readyState === WebSocket.OPEN && state.streamSid) {
      socket.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }
 
  function addSystemContext(text) {
    sendToOpenAI({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [{ type: "input_text", text }],
      },
    });
  }
 
  function maybeSendGreeting() {
    if (state.greetingSent || !state.openAiReady || !state.streamSid) return;
 
    state.greetingSent = true;
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
 
    // L'IA connaît dès le départ l'état réel de l'identité.
    addSystemContext(
      state.identityKnown
        ? `IDENTITÉ APPELANT : confirmée (${state.identityName || "contact connu"}). Ne redemande pas son identité.`
        : "IDENTITÉ APPELANT : non confirmée. Avant toute fin d'appel, demande le nom et le prénom une seule fois."
    );
 
    sendToOpenAI({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        instructions: `Dis exactement et uniquement : "${greeting}" Puis arrête-toi et attends la réponse du client. N'ajoute aucune seconde formule d'accueil ni aucune question sur un équipement précis.`,
      },
    });
  }
 
  function setIdentityKnown(name, source = "conversation") {
    if (!name || state.identityKnown) return;
 
    state.identityKnown = true;
    state.identityName = name;
    state.awaitingIdentity = false;
    state.identityRecoveryNeeded = false;
 
    addSystemContext(
      `IDENTITÉ APPELANT CONFIRMÉE : ${name}. Ne redemande plus l'identité pendant cet appel.`
    );
 
    app.log.info({ source, name }, "Identité client confirmée");
  }
 
  async function loadN8nContext(callerMessage) {
    if (state.n8nLoaded || state.n8nLoading) return;
    if (state.n8nAttempts >= 2) return;
    if (!isUsefulCallerMessage(callerMessage)) return;
 
    state.n8nLoading = true;
    state.n8nAttempts += 1;
 
    try {
      app.log.info(
        {
          callerMessage,
          callerPhone: maskPhone(state.callerPhone),
          attempt: state.n8nAttempts,
        },
        "Envoi de la demande au cerveau n8n"
      );
 
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caller_message: callerMessage,
          caller_phone: state.callerPhone,
          phone: state.callerPhone,
          call_sid: state.callSid,
        }),
      });
 
      if (!response.ok) {
        throw new Error(`n8n HTTP ${response.status}`);
      }
 
      const responseText = await response.text();
      if (!responseText.trim()) {
        throw new Error("Réponse n8n vide");
      }
 
      let context;
      try {
        context = JSON.parse(responseText);
      } catch {
        throw new Error("Réponse n8n non JSON");
      }
 
      const businessContext = buildBusinessContext(context);
      addSystemContext(businessContext);
      state.n8nLoaded = true;
 
      // Compatible avec une future réponse n8n qui contiendra un contact confirmé.
      const identity = context.identity;
      if (identity?.known === true && identity?.name) {
        setIdentityKnown(identity.name, "n8n");
      }
 
      app.log.info(
        {
          category: context.routing?.category,
          urgency: context.routing?.urgency,
        },
        "Contexte n8n injecté dans Tom"
      );
    } catch (error) {
      app.log.error(error, "Erreur récupération contexte n8n");
    } finally {
      state.n8nLoading = false;
    }
  }
 
  function requestIdentityRecovery() {
    if (state.identityKnown || state.awaitingIdentity) return;
 
    state.awaitingIdentity = true;
 
    sendToOpenAI({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        instructions:
          'Ne termine pas encore l’appel. Demande uniquement : "Avant de terminer, pouvez-vous me donner votre nom et votre prénom ?" Puis attends la réponse.',
      },
    });
  }
 
  function schedulePlaybackMark() {
    if (!state.streamSid || !state.responseHadAudio || state.playbackMark) return;
 
    const markName = `playback-${Date.now()}`;
    state.playbackMark = markName;
    state.responseHadAudio = false;
 
    sendToTwilio({
      event: "mark",
      streamSid: state.streamSid,
      mark: { name: markName },
    });
  }
 
  function scheduleHangupAfterPlayback() {
    if (!state.pendingHangup || !state.streamSid || state.hangupMark) return;
 
    const markName = `hangup-${Date.now()}`;
    state.hangupMark = markName;
 
    sendToTwilio({
      event: "mark",
      streamSid: state.streamSid,
      mark: { name: markName },
    });
 
    // Sécurité : si le mark ne revient pas, on ne laisse pas l'appel ouvert indéfiniment.
    state.hangupFallback = setTimeout(() => {
      if (socket.readyState === WebSocket.OPEN) {
        app.log.warn("Raccrochage de secours après attente du mark Twilio");
        socket.close(1000, "call-complete");
      }
    }, 6000);
  }
 
  function interruptAssistantPlayback() {
    const audioMayStillBePlaying =
      state.assistantSpeaking || Boolean(state.playbackMark);
 
    if (!audioMayStillBePlaying || !state.streamSid) return;
 
    state.pendingHangup = false;
    if (state.hangupFallback) {
      clearTimeout(state.hangupFallback);
      state.hangupFallback = null;
    }
    state.hangupMark = null;
    state.playbackMark = null;
    state.responseHadAudio = false;
 
    // OpenAI est déjà configuré avec interrupt_response=true.
    // Le clear est indispensable côté Twilio pour vider l'audio déjà bufferisé.
    sendToTwilio({ event: "clear", streamSid: state.streamSid });
    state.assistantSpeaking = false;
 
    app.log.info("Interruption client : buffer audio Twilio vidé");
  }
 
  openAiWs.on("open", () => {
    app.log.info("Connexion OpenAI Realtime ouverte");
 
    sendToOpenAI({
      type: "session.update",
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        output_modalities: ["audio"],
        instructions: SYSTEM_PROMPT,
        audio: {
          input: {
            format: { type: "audio/pcmu" },
            transcription: {
              model: TRANSCRIBE_MODEL,
              language: "fr",
            },
            turn_detection: {
              type: "semantic_vad",
              eagerness: "high",
              create_response: true,
              interrupt_response: true,
            },
          },
          output: {
            format: { type: "audio/pcmu" },
            voice: "cedar",
            speed: 1.05,
          },
        },
      },
    });
  });
 
  openAiWs.on("message", (raw) => {
    try {
      const event = JSON.parse(raw.toString());
 
      if (event.type === "session.updated") {
        state.openAiReady = true;
        maybeSendGreeting();
      }
 
      if (event.type === "input_audio_buffer.speech_started") {
        interruptAssistantPlayback();
      }
 
      if (
        event.type ===
        "conversation.item.input_audio_transcription.completed"
      ) {
        const callerMessage = event.transcript?.trim();
 
        if (callerMessage) {
          app.log.info({ callerMessage }, "Transcription client reçue");
 
          if (!state.identityKnown) {
            const volunteeredName = callerMessage.match(
              /^(?:je m['’]appelle|moi c['’]est|mon nom c['’]est|je suis)\s+(.+)$/i
            );
 
            if (volunteeredName?.[1]) {
              const name = extractNameCandidate(volunteeredName[1]);
              if (name) setIdentityKnown(name, "volontaire");
            } else if (state.awaitingIdentity) {
              const name = extractNameCandidate(callerMessage);
              if (name) {
                setIdentityKnown(name, "question-identité");
              } else {
                app.log.info(
                  { callerMessage },
                  "Réponse reçue mais identité non validée"
                );
              }
            }
          }
 
          void loadN8nContext(callerMessage);
        }
      }
 
      if (event.type === "response.output_audio.delta") {
        state.assistantSpeaking = true;
        state.responseHadAudio = true;
 
        if (state.streamSid && socket.readyState === WebSocket.OPEN) {
          sendToTwilio({
            event: "media",
            streamSid: state.streamSid,
            media: { payload: event.delta },
          });
        }
      }
 
      if (event.type === "response.output_audio_transcript.done") {
        const assistantText = event.transcript?.trim() || "";
 
        if (assistantAskedForIdentity(assistantText)) {
          state.awaitingIdentity = true;
        }
 
        if (assistantIsClosing(assistantText)) {
          if (state.identityKnown) {
            state.pendingHangup = true;
            app.log.info(
              { assistantText },
              "Fin d'appel détectée ; attente de fin audio"
            );
          } else {
            state.pendingHangup = false;
            state.identityRecoveryNeeded = true;
            app.log.info("Fin refusée : identité client inconnue");
          }
        }
      }
 
      if (event.type === "response.done") {
        state.assistantSpeaking = false;
 
        if (state.identityRecoveryNeeded && !state.identityKnown) {
          state.identityRecoveryNeeded = false;
          requestIdentityRecovery();
        } else if (state.pendingHangup && state.identityKnown) {
          scheduleHangupAfterPlayback();
        } else {
          schedulePlaybackMark();
        }
      }
 
      if (event.type === "error") {
        app.log.error({ openaiError: event }, "Erreur OpenAI Realtime");
      }
    } catch (error) {
      app.log.error(error, "Erreur traitement message OpenAI");
    }
  });
 
  openAiWs.on("close", () => {
    app.log.info("Connexion OpenAI Realtime fermée");
 
    if (!state.closed && socket.readyState === WebSocket.OPEN) {
      socket.close(1011, "openai-closed");
    }
  });
 
  openAiWs.on("error", (error) => {
    app.log.error(error, "Erreur WebSocket OpenAI");
  });
 
  socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());
 
      switch (message.event) {
        case "start": {
          state.streamSid = message.start.streamSid;
          state.callSid = message.start.callSid || null;
          state.callerPhone =
            message.start.customParameters?.callerPhone || null;
          state.calledPhone =
            message.start.customParameters?.calledPhone || null;
 
          app.log.info(
            {
              streamSid: state.streamSid,
              callSid: state.callSid,
              callerPhone: maskPhone(state.callerPhone),
            },
            "Flux Twilio démarré"
          );
 
          maybeSendGreeting();
          break;
        }
 
        case "media":
          sendToOpenAI({
            type: "input_audio_buffer.append",
            audio: message.media.payload,
          });
          break;
 
        case "mark":
          if (message.mark?.name === state.playbackMark) {
            state.playbackMark = null;
          }
 
          if (message.mark?.name === state.hangupMark) {
            if (state.hangupFallback) {
              clearTimeout(state.hangupFallback);
              state.hangupFallback = null;
            }
 
            app.log.info("Fin audio confirmée par Twilio ; raccrochage");
            if (socket.readyState === WebSocket.OPEN) {
              socket.close(1000, "call-complete");
            }
          }
          break;
 
        case "stop":
          app.log.info("Flux Twilio arrêté");
          state.closed = true;
 
          if (openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.close(1000, "twilio-stop");
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
    state.closed = true;
    if (state.hangupFallback) clearTimeout(state.hangupFallback);
 
    app.log.info("Connexion Twilio fermée");
 
    if (openAiWs.readyState === WebSocket.OPEN) {
      openAiWs.close(1000, "twilio-closed");
    }
  });
 
  socket.on("error", (error) => {
    app.log.error(error, "Erreur WebSocket Twilio");
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
