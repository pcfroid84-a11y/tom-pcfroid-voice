function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function classifyBusinessUrgency(input = {}) {
  const equipment = normalize(input.equipment);
  const noCooling = input.noCooling === true;

  // Règle métier déjà présente dans le parcours PC Froid : chambre froide sans froid.
  if (equipment === "chambre froide" && noCooling) {
    if (input.hasGoods === false) {
      return {
        level: "PLANIFIER",
        confirmedUrgency: false,
        reason: "Chambre froide sans marchandise à conserver.",
      };
    }

    if (input.hasGoods === true) {
      const goodsSafe = input.goodsSecured === true || input.backupCooling === true;
      if (goodsSafe) {
        return {
          level: "IMPORTANT",
          confirmedUrgency: false,
          reason: "Marchandise mise en sécurité ou solution frigorifique de secours disponible.",
        };
      }

      if (input.goodsSecured === false && input.backupCooling === false) {
        return {
          level: "URGENCE",
          confirmedUrgency: true,
          reason: "Marchandise à conserver sans solution frigorifique de secours.",
        };
      }
    }

    return {
      level: "À_QUALIFIER",
      confirmedUrgency: false,
      reason: "Il manque l'information sur la marchandise ou la solution de secours.",
    };
  }

  // Pour les autres équipements, une demande pressante du client ne suffit pas
  // à créer automatiquement une urgence métier.
  if (input.callerSaysUrgent === true) {
    return {
      level: "À_VÉRIFIER_HUMAIN",
      confirmedUrgency: false,
      reason: "Le client indique une urgence, mais aucune règle métier validée ne permet de la confirmer automatiquement.",
    };
  }

  return {
    level: "NORMAL",
    confirmedUrgency: false,
    reason: "Aucune règle d'urgence métier validée ne s'applique.",
  };
}
