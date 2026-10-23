
/**
 * Combat Métro 2033 :
 * le plus petit numéro d'initiative agit en premier.
 */
export class MetroCombat extends foundry.documents.Combat {
  _sortCombatants(a, b) {
    const initiativeA = Number.isFinite(a.initiative)
      ? a.initiative
      : Number.POSITIVE_INFINITY;

    const initiativeB = Number.isFinite(b.initiative)
      ? b.initiative
      : Number.POSITIVE_INFINITY;

    return initiativeA - initiativeB
      || String(a.id).localeCompare(String(b.id));
  }
}

/**
 * Tire une permutation aléatoire des valeurs 1 à N,
 * sans doublon, où N est le nombre de combattants.
 */
function drawUniqueInitiatives(count) {
  const values = Array.from(
    { length: count },
    (_, index) => index + 1
  );

  // Mélange de Fisher-Yates.
  for (let index = values.length - 1; index > 0; index--) {
    const otherIndex = Math.floor(Math.random() * (index + 1));

    [values[index], values[otherIndex]] = [
      values[otherIndex],
      values[index]
    ];
  }

  return values;
}

export async function drawMetroInitiative(combat) {
  if (!game.user.isGM) {
    ui.notifications.warn("Seul le MJ peut tirer l'initiative.");
    return;
  }

  if (!combat) {
    ui.notifications.warn(
      "Aucun combat sélectionné. Ajoute d'abord les combattants au suivi de combat."
    );
    return;
  }

  if (combat.started) {
    ui.notifications.warn(
      "Le combat a commencé : l'ordre d'initiative ne peut plus être retiré par ce bouton."
    );
    return;
  }

  const allCombatants = Array.from(combat.combatants);
  const combatants = allCombatants.filter(
    combatant => !combatant.defeated
  );

  if (combatants.length === 0) {
    ui.notifications.warn(
      "Aucun combattant actif dans cette rencontre."
    );
    return;
  }

  const hasExistingInitiative = allCombatants.some(
    combatant => combatant.initiative !== null
      && combatant.initiative !== undefined
  );

  if (hasExistingInitiative) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Recommencer le tirage d'initiative ?"
      },
      content: `
        <p>Au moins une initiative est déjà attribuée.</p>
        <p>Veux-tu remplacer les valeurs par un nouveau tirage sans remise ?</p>
      `,
      yes: {
        label: "Nouveau tirage"
      },
      no: {
        label: "Annuler"
      },
      rejectClose: false,
      modal: true
    });

    if (!confirmed) return;
  }

  const cardValues = drawUniqueInitiatives(combatants.length);

  const assignedValues = combatants.map((combatant, index) => ({
    _id: combatant.id,
    initiative: cardValues[index]
  }));

  // Si le tirage est recommencé, les combattants déjà vaincus
  // ne conservent pas une ancienne valeur d'initiative.
  const defeatedValues = allCombatants
    .filter(combatant => combatant.defeated)
    .map(combatant => ({
      _id: combatant.id,
      initiative: null
    }));

  await combat.updateEmbeddedDocuments("Combatant", [
    ...assignedValues,
    ...defeatedValues
  ]);

  const total = combatants.length;

  ui.notifications.info(
    `Initiative Métro 2033 tirée pour ${total} combattant${total > 1 ? "s" : ""} : valeurs de 1 à ${total}, sans remise.`
  );

  console.log(
    `Métro 2033 | Initiative tirée pour ${total} combattants.`
  );
}

/**
 * Ajoute un bouton dans le suivi de combat de Foundry.
 */
export function registerMetroInitiativeButton() {
  Hooks.on("renderCombatTracker", (app, html) => {
    if (!game.user?.isGM) return;

    const root = app?.element instanceof HTMLElement
      ? app.element
      : html?.[0] instanceof HTMLElement
        ? html[0]
        : html;

    if (!(root instanceof HTMLElement)) return;

    if (root.querySelector("[data-metro2033-initiative-button]")) {
      return;
    }

    const controls = root.querySelector(".encounter-controls");
    const header = root.querySelector(".combat-tracker-header");
    const tracker = root.querySelector(".combat-tracker");
    const insertionPoint = controls ?? header ?? tracker;

    if (!insertionPoint) {
      console.warn(
        "Métro 2033 | Impossible de trouver l'emplacement du bouton d'initiative."
      );
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("metro2033-initiative-button");
    button.dataset.metro2033InitiativeButton = "true";
    button.innerHTML = `
      <i class="fas fa-clone" aria-hidden="true"></i>
      <span>Tirer initiative Métro 2033</span>
    `;

    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();

      button.disabled = true;

      try {
        const combat = app.viewed ?? game.combat;
        await drawMetroInitiative(combat);
      } catch (error) {
        console.error(
          "Métro 2033 | Erreur du tirage d'initiative",
          error
        );
        ui.notifications.error(
          "Impossible de tirer l'initiative. Consulte la console."
        );
      } finally {
        button.disabled = false;
      }
    });

    insertionPoint.insertAdjacentElement("afterend", button);
  });
}
