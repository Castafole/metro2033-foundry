
const RESERVE_LABELS = {
  eau: "Eau",
  nourriture: "Nourriture",
  filtresAir: "Filtres à air",
  energie: "Énergie"
};

function escapeHTML(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

export async function rollReserve(actor, reserveKey) {
  const label = RESERVE_LABELS[reserveKey];
  const level = actor.system?.reserves?.[reserveKey];

  if (!label || !Number.isInteger(level)) {
    ui.notifications.warn("Impossible de retrouver cette réserve.");
    return;
  }

  if (level <= 0) {
    ui.notifications.info(`La réserve de ${label.toLowerCase()} est épuisée.`);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <article class="metro-chat-reserve">
          <h2>Jet de réserve — ${escapeHTML(label)}</h2>
          <p>La réserve est déjà à 0 : il n'y a plus de consommable disponible.</p>
        </article>
      `
    });

    return;
  }

  const diceCount = Math.min(level, 5);

  const roll = await new foundry.dice.Roll(
    `${diceCount}d6`
  ).evaluate();

  const results = roll.terms[0].results.map(
    result => Number(result.result)
  );

  const losses = results.filter(value => value === 1).length;
  const newLevel = Math.max(0, level - losses);

  await actor.update({
    [`system.reserves.${reserveKey}`]: newLevel
  });

  const diceHTML = results.map((value, index) => {
    const classes = ["metro-roll-die", "metro-roll-die-normal"];

    if (value === 1) classes.push("is-affliction");
    if (value === 6) classes.push("is-success");

    return `
      <span class="${classes.join(" ")}" title="Dé ${index + 1}">
        ${value}
      </span>
    `;
  }).join("");

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <article class="metro-chat-reserve">
        <h2>Jet de réserve — ${escapeHTML(label)}</h2>

        <p><strong>Niveau avant le jet :</strong> ${level}/10</p>
        <p><strong>Dés lancés :</strong> ${diceCount} D6</p>

        <div class="metro-roll-dice">${diceHTML}</div>

        <p><strong>Résultats de 1 :</strong> ${losses}</p>
        <p><strong>Nouveau niveau :</strong> ${newLevel}/10</p>

        ${newLevel === 0
          ? "<p><strong>Réserve épuisée !</strong></p>"
          : ""}
      </article>
    `
  });
}
