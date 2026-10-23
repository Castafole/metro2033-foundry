
function escapeHTML(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function countStressDice(actor) {
  const stress = actor?.system?.stress;
  if (!stress) return 0;

  return Object.values(stress).filter(value => value === true).length;
}

/**
 * Fenêtre ouverte par le MJ pour demander une attaque de Terreur
 * à tous les joueurs connectés qui possèdent un PJ assigné.
 */
async function requestTerrorAttack() {
  if (!game.user.isGM) {
    ui.notifications.warn("Seul le MJ peut demander une attaque de Terreur.");
    return;
  }

  const formData = await foundry.applications.api.DialogV2.input({
    classes: ["metro2033", "metro-terror-dialog"],
    window: {
      title: "Déclencher une attaque de Terreur"
    },
    content: `
      <div class="metro-terror-dialog-content">
        <label>
          <span>Source de Terreur (facultatif)</span>
          <input
            type="text"
            name="source"
            value="Une présence terrifiante"
            placeholder="Ex. : des ombres dans le tunnel"
          >
        </label>

        <label>
          <span>Valeur de Terreur (nombre de D6)</span>
          <input
            type="number"
            name="terrorValue"
            value="3"
            min="1"
            max="50"
            step="1"
            required
          >
        </label>

        <p class="metro-terror-hint">
          Valeurs usuelles : 3 (effrayante), 5 (atroce) et 8 (abominable).
          Les dés de Stress de chaque PJ seront ajoutés individuellement.
        </p>
      </div>
    `,
    ok: {
      label: "Demander les jets"
    },
    rejectClose: false,
    modal: true
  });

  if (!formData) return;

  const source = String(formData.source ?? "").trim()
    || "Une présence terrifiante";

  const terrorValue = Number(formData.terrorValue);

  if (!Number.isInteger(terrorValue) || terrorValue < 1 || terrorValue > 50) {
    ui.notifications.warn("La valeur de Terreur doit être un entier entre 1 et 50.");
    return;
  }

  const players = Array.from(game.users).filter(user =>
    !user.isGM
    && user.active
    && user.character
    && user.character.type === "player"
  );

  if (players.length === 0) {
    ui.notifications.warn(
      "Aucun joueur connecté avec un PJ assigné. Vérifie les personnages associés aux utilisateurs."
    );
    return;
  }

  const requestId = foundry.utils.randomID();

  for (const player of players) {
    game.socket.emit("system.metro2033", {
      type: "terror-request",
      requestId,
      targetUserId: player.id,
      actorUuid: player.character.uuid,
      gmId: game.user.id,
      source,
      terrorValue
    });
  }

  ui.notifications.info(
    `Attaque de Terreur envoyée à ${players.length} joueur${players.length > 1 ? "s" : ""}.`
  );
}

/**
 * Fenêtre destinée au joueur concerné.
 */
async function showTerrorPrompt(request) {
  if (game.user.isGM || game.user.id !== request.targetUserId) return;

  const sender = game.users.get(request.gmId);
  if (!sender?.isGM) return;

  const actor = game.user.character;

  if (!actor || actor.uuid !== request.actorUuid || actor.type !== "player") {
    ui.notifications.warn(
      "Le PJ associé à cette demande n'est plus disponible."
    );
    return;
  }

  const stressDice = countStressDice(actor);
  const totalDice = request.terrorValue + stressDice;

  const formData = await foundry.applications.api.DialogV2.input({
    classes: ["metro2033", "metro-terror-dialog"],
    window: {
      title: "Attaque de Terreur !"
    },
    content: `
      <div class="metro-terror-dialog-content">
        <h3>${escapeHTML(request.source)}</h3>

        <p>Une attaque de Terreur vous vise ! Préparez-vous à lancer les dés.</p>

        <div class="metro-terror-summary">
          <p>Valeur de Terreur : <strong>${request.terrorValue} D6</strong></p>
          <p>Vos dés de Stress : <strong>${stressDice} D6</strong></p>
          <p>Total à lancer : <strong>${totalDice} D6</strong></p>
        </div>

        <p class="metro-terror-hint">
          Chaque résultat de 6 inflige 1 point de dégâts à l'Esprit.
          Ce jet ne peut pas être forcé. Les dégâts ne seront pas appliqués automatiquement.
        </p>
      </div>
    `,
    ok: {
      label: "Lancer l'attaque de Terreur"
    },
    rejectClose: false,
    modal: true
  });

  if (!formData) return;

  try {
    const roll = await new foundry.dice.Roll(`${totalDice}d6`).evaluate();

    const results = roll.terms?.[0]?.results?.map(
      result => Number(result.result)
    ) ?? [];

    // On sépare visuellement les dés de Terreur et les dés ajoutés par le Stress.
    const terrorResults = results.slice(0, request.terrorValue);
    const stressResults = results.slice(request.terrorValue);

    // Pour une attaque de Terreur, chaque 6 obtenu compte comme une réussite.
    const successes = results.filter(value => value === 6).length;

    const renderDice = (values, className) => {
      if (!values.length) {
        return '<span class="metro-roll-empty">Aucun dé</span>';
      }

      return values.map((value, index) => {
        const classes = ["metro-roll-die", className];

        if (value === 6) classes.push("is-success");

        return `
          <span class="${classes.join(" ")}" title="Dé ${index + 1}">
            ${value}
          </span>
        `;
      }).join("");
    };

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <article class="metro-chat-terror">
          <h2>Attaque de Terreur — ${escapeHTML(request.source)}</h2>

          <p><strong>Cible :</strong> ${escapeHTML(actor.name)}</p>

          <div class="metro-terror-chat-group">
            <h4>Dés de Terreur (${request.terrorValue})</h4>
            <div class="metro-roll-dice">
              ${renderDice(terrorResults, "metro-roll-die-normal")}
            </div>
          </div>

          <div class="metro-terror-chat-group">
            <h4>Dés de Stress ajoutés (${stressDice})</h4>
            <div class="metro-roll-dice">
              ${renderDice(stressResults, "metro-roll-die-stress")}
            </div>
          </div>

          <div class="metro-roll-totals">
            <div>
              <span>Réussites (6)</span>
              <strong>${successes}</strong>
            </div>
            <div>
              <span>Dégâts à l'Esprit</span>
              <strong>${successes}</strong>
            </div>
          </div>

          <p class="metro-terror-hint">
            Jet non forçable. Applique manuellement les dégâts à l'Esprit
            ou, si les règles le permettent, choisis de les convertir en Stress.
          </p>
        </article>
      `
    });
  } catch (error) {
    console.error("Métro 2033 | Erreur d'attaque de Terreur", error);
    ui.notifications.error(
      "Impossible de lancer l'attaque de Terreur. Consulte la console."
    );
  }
}

/**
 * Enregistre la macro MJ et le canal de communication avec les joueurs.
 */
export function registerTerrorAttackTools() {
  Hooks.once("ready", () => {
    game.metro2033 = game.metro2033 || {};
    game.metro2033.requestTerrorAttack = requestTerrorAttack;
    game.socket.on("system.metro2033", async request => {
    console.log(
        "Métro 2033 | Message reçu",
        request,
        "| utilisateur :",
        game.user.id,
        "| MJ :",
        game.user.isGM
    );

    if (request?.type !== "terror-request") return;
    if (game.user.isGM) return;
    if (request.targetUserId !== game.user.id) return;

    console.log("Métro 2033 | Demande destinée à ce joueur");

    try {
        await showTerrorPrompt(request);
    } catch (error) {
        console.error(
        "Métro 2033 | Erreur lors de l'ouverture de la fenêtre de Terreur",
        error
        );
    }
    });

    console.log("Métro 2033 | Outils d'attaque de Terreur chargés");
  });
}
