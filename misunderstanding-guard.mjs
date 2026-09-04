export function createMisunderstandingState() {
  return {
    consecutiveUnclearTurns: 0,
    transferRequested: false,
    reason: null,
  };
}

export function updateMisunderstandingGuard(state, outcome, { maxUnclearTurns = 2 } = {}) {
  const current = state || createMisunderstandingState();

  if (outcome === "explicit_human_request") {
    return {
      consecutiveUnclearTurns: current.consecutiveUnclearTurns,
      transferRequested: true,
      reason: "client_demande_humain",
    };
  }

  if (outcome === "understood") {
    return {
      consecutiveUnclearTurns: 0,
      transferRequested: false,
      reason: null,
    };
  }

  if (outcome !== "unclear") return { ...current };

  const count = current.consecutiveUnclearTurns + 1;
  if (count >= maxUnclearTurns) {
    return {
      consecutiveUnclearTurns: count,
      transferRequested: true,
      reason: "incomprehension_repetee",
    };
  }

  return {
    consecutiveUnclearTurns: count,
    transferRequested: false,
    reason: "reformulation_autorisee",
  };
}

export function transferPhrase() {
  return "Je suis désolé, je préfère vous passer quelqu’un de l’équipe qui pourra mieux vous répondre. Ne quittez pas, je vous transfère.";
}

export function noAnswerFallbackPhrase() {
  return "Je suis désolé, personne de l’équipe n’est disponible pour le moment. Je prends votre demande et quelqu’un vous rappellera.";
}
