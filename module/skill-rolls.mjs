
const ATTRIBUTE_LABELS = {
  vigueur: "Vigueur",
  agilite: "Agilité",
  empathie: "Empathie",
  esprit: "Esprit"
};

const SKILL_LABELS = {
  bricolage: "Bricolage",
  corpsMelee: "Corps à corps",
  endurance: "Endurance",
  furtivite: "Furtivité",
  reaction: "Réaction",
  tir: "Tir",
  soins: "Soins",
  manipulation: "Manipulation",
  analyse: "Analyse",
  survie: "Survie",
  observation: "Observation",
  comprehension: "Compréhension"
};

const forcingInProgress = new Set();

function escapeHTML(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function countStressDice(actor) {
  const stress = actor.system?.stress;
  if (!stress) return 0;

  return Object.values(stress).filter(value => value === true).length;
}

function getNextStressField(actor) {
  const stress = actor?.system?.stress;
  if (!stress) return null;

  return Object.keys(stress)
    .sort((a, b) => {
      const numberA = Number(a.match(/\d+$/)?.[0] ?? 0);
      const numberB = Number(b.match(/\d+$/)?.[0] ?? 0);
      return numberA - numberB;
    })
    .find(key => stress[key] === false) ?? null;
}

function countOnes(values) {
  return values.filter(value => value === 1).length;
}


async function rollD6(count) {
  count = Math.max(0, Math.floor(Number(count) || 0));

  if (count === 0) return [];

  const roll = await new foundry.dice.Roll(`${count}d6`).evaluate();

  const dieTerm = roll.terms[0];

  return (dieTerm?.results ?? []).map(die => Number(die.result));
}



function renderDice(values, type, forced, initial = true, onesAreAfflictions = false) {
  if (!values.length) {
    return '<span class="metro-roll-empty">Aucun dé</span>';
  }

  return values.map((value, index) => {
    const classes = [
      "metro-roll-die",
      type === "stress"
        ? "metro-roll-die-stress"
        : "metro-roll-die-normal"
    ];

    let title = `Dé ${index + 1} : ${value}`;

    if (type === "normal" && value === 6) {
      classes.push("is-success");
      title += " — réussite";
    }

    if (type === "stress" && value === 6) {
      classes.push("is-eliminated");
      title += " — dé de Stress éliminé";
    }

    if (value === 1) {
      if (onesAreAfflictions) {
        classes.push("is-affliction");
        title += " — affliction";
      } else {
        classes.push("is-neutral-one");
        title += " — résultat sans affliction comptabilisée à cette étape";
      }
    }

    if (initial && !forced && value !== 6) {
      classes.push("will-reroll");
    }

    if (initial && forced && value !== 6) {
      classes.push("was-rerolled");
    }

    return `<span class="${classes.join(" ")}" title="${title}">${value}</span>`;
  }).join("");
}

function renderDiceGroup(
  title,
  values,
  type,
  forced,
  initial = true,
  onesAreAfflictions = false
) {
  const diceLabel = values.length === 1 ? "1 dé" : `${values.length} dés`;

  return `
    <section class="metro-roll-group">
      <div class="metro-roll-group-heading">
        <h4>${title}</h4>
        <span>${diceLabel}</span>
      </div>
      <div class="metro-roll-dice">
        ${renderDice(values, type, forced, initial, onesAreAfflictions)}
      </div>
    </section>
  `;
}



function renderSkillCard(state) {
  const forceCount = Number(state.forceCount ?? (state.forced ? 1 : 0));

  const classicInitial = state.classicInitial ?? [];
  const stressInitial = state.stressInitial ?? [];
  const classicRerolls = state.classicRerolls ?? [];
  const stressRerolls = state.stressRerolls ?? [];
  const classicRerolls2 = state.classicRerolls2 ?? [];
  const stressRerolls2 = state.stressRerolls2 ?? [];

  const allClassicDice = [
    ...classicInitial,
    ...classicRerolls,
    ...classicRerolls2
  ];

  const successes = allClassicDice.filter(value => value === 6).length;

  let afflictions = 0;

  if (forceCount === 0) {
    afflictions = countOnes(stressInitial);
  } else if (forceCount === 1) {
    afflictions =
      countOnes(classicRerolls)
      + countOnes(stressInitial)
      + countOnes(stressRerolls);
  } else {
    afflictions =
      countOnes(classicRerolls2)
      + countOnes(stressRerolls2);

    // Le talent ordinaire laisse les 1 du premier forçage en place.
    if (state.secondForceMode === "talent") {
      afflictions += countOnes(classicRerolls);
      afflictions += countOnes(stressRerolls);
    }
  }

  const canForce = forceCount === 0
    ? (
      classicInitial.some(value => value !== 6)
      || stressInitial.some(value => value !== 6)
    )
    : forceCount === 1
      ? (
        classicRerolls.some(value => value !== 6)
        || stressRerolls.some(value => value !== 6)
      )
      : false;

  const modifierText = state.modifier >= 0
    ? `+ ${state.modifier}`
    : `− ${Math.abs(state.modifier)}`;

  let forcedResults = "";

  if (forceCount >= 1) {
    const firstForceKeepsOnes = forceCount === 2
      && state.secondForceMode === "talent";

    forcedResults = `
      <h3 class="metro-roll-subheading">Premier forçage</h3>
      ${renderDiceGroup(
        "Dés classiques relancés",
        classicRerolls,
        "normal",
        true,
        false,
        forceCount === 1 || firstForceKeepsOnes
      )}
      ${renderDiceGroup(
        "Dés de Stress relancés",
        stressRerolls,
        "stress",
        true,
        false,
        forceCount === 1 || firstForceKeepsOnes
      )}
    `;
  }

  if (forceCount >= 2) {
    forcedResults += `
      <h3 class="metro-roll-subheading">Second forçage</h3>
      ${renderDiceGroup(
        "Dés classiques relancés",
        classicRerolls2,
        "normal",
        true,
        false,
        true
      )}
      ${renderDiceGroup(
        state.secondForceMode === "stress"
          ? "Dés de Stress relancés (+1 dé ajouté)"
          : "Dés de Stress relancés",
        stressRerolls2,
        "stress",
        true,
        false,
        true
      )}
    `;
  }

  let explanation;

  if (forceCount === 0) {
    explanation = `
      Les 1 des dés classiques n'ont aucun effet au jet initial.
      Les 1 des dés de Stress produisent immédiatement des afflictions.
    `;
  } else if (forceCount === 1) {
    explanation = `
      Le jet a été forcé une fois. Les afflictions restent à attribuer
      manuellement par le joueur ou le MJ.
    `;
  } else if (state.secondForceMode === "talent") {
    explanation = `
      Second forçage par talent : les 1 du premier forçage n'ont pas été
      relancés et sont comptabilisés comme afflictions.
    `;
  } else if (state.secondForceMode === "talentSuperior") {
    explanation = `
      Second forçage par talent supérieur : les 1 du premier forçage
      ont pu être relancés. Les afflictions restent à attribuer manuellement.
    `;
  } else {
    explanation = `
      Second forçage après prise d'un dé de Stress. La case de Stress
      supplémentaire a été cochée. Les afflictions restent à attribuer manuellement.
    `;
  }

  return `
    <article class="metro-roll-card">
      <header class="metro-roll-header">
        <h3>${escapeHTML(state.skillLabel)}</h3>
        <span>${escapeHTML(state.attributeLabel)} — ${escapeHTML(state.actorName)}</span>
      </header>

      <div class="metro-roll-formula">
        <span>Attribut : <strong>${state.attributeValue}</strong></span>
        <span>Compétence : <strong>${state.skillValue}</strong></span>
        ${state.weaponName ? `<span>Arme : <strong>${escapeHTML(state.weaponName)}</strong></span><span>Bonus d'arme : <strong>+${Number(state.equipmentBonus) || 0}</strong></span>` : ""}
        <span>Modificateur : <strong>${modifierText}</strong></span>
        <span>Dés classiques au jet initial : <strong>${state.dicePool}</strong></span>
        <span>Dés de Stress au jet initial : <strong>${state.stressDiceCount}</strong></span>
      </div>

      <h3 class="metro-roll-subheading">Jet initial</h3>

      ${renderDiceGroup(
        "Dés classiques",
        classicInitial,
        "normal",
        forceCount > 0,
        true,
        false
      )}

      ${renderDiceGroup(
        "Dés de Stress",
        stressInitial,
        "stress",
        forceCount > 0,
        true,
        forceCount < 2
      )}

      ${forcedResults}

      <div class="metro-roll-totals">
        <div>
          <span>Réussites</span>
          <strong>${successes}</strong>
        </div>
        <div>
          <span>Afflictions</span>
          <strong>${afflictions}</strong>
        </div>
      </div>

      <p class="metro-roll-outcome ${successes > 0 ? "is-success" : "is-failure"}">
        ${successes > 0 ? "Réussite" : "Échec"}
      </p>

      <p class="metro-roll-explanation">${explanation}</p>

      ${canForce ? `
        <button type="button" class="metro-force-roll" data-metro-force-skill>
          ${forceCount === 0 ? "Forcer le jet" : "Re-forcer"}
        </button>
      ` : ""}
    </article>
  `;
}


export async function promptSkillRoll(
  actor,
  attributeKey,
  skillKey,
  skillLabel,
  options = {}
) {
  const attribute = actor.system?.[attributeKey];

  if (!attribute || !attribute.skills || attribute.skills[skillKey] === undefined) {
    ui.notifications.warn("Impossible de retrouver cet attribut ou cette compétence.");
    return;
  }

  const attributeValue = Number(attribute.value) || 0;
  const skillValue = Number(attribute.skills[skillKey]) || 0;
  const basePool = attributeValue + skillValue;
  const equipmentBonus = Math.max(
  0,
  Math.floor(Number(options.equipmentBonus) || 0)
);

const weaponName = options.weaponName
  ? String(options.weaponName)
  : "";

const safeWeaponName = escapeHTML(weaponName);
  const stressDiceCount = countStressDice(actor);

  const safeSkillLabel = escapeHTML(skillLabel);
  const attributeLabel = ATTRIBUTE_LABELS[attributeKey] ?? attributeKey;

  const formData = await foundry.applications.api.DialogV2.input({
    classes: ["metro2033", "metro-roll-dialog"],
    window: {
      title: `Jet de ${skillLabel}`
    },
    content: `
      <div class="metro-roll-dialog-content">
        <h3>${safeSkillLabel}</h3>

        <div class="metro-roll-formula">
          <p>Attribut : <strong>${attributeValue}</strong></p>
          <p>Compétence : <strong>${skillValue}</strong></p>
          ${weaponName ? `<p>Arme : <strong>${safeWeaponName}</strong> — bonus : <strong>+${equipmentBonus} dé(s)</strong></p>` : ""}
        <p>Total avant modificateur : <strong>${basePool + equipmentBonus} dés</strong></p>
          <p>Dés de Stress : <strong>${stressDiceCount}</strong></p>
        </div>

        <label class="metro-roll-modifier">
          <span>Modificateur de situation ou d'équipement</span>
          <input
            type="number"
            name="modifier"
            value="0"
            step="1"
            autofocus
          >
        </label>

        <p class="metro-roll-explanation">
          Tu peux ajouter un bonus positif ou négatif au nombre de dés classiques.
        </p>
      </div>
    `,
    ok: {
      label: "Lancer"
    },
    rejectClose: false,
    modal: true
  });

  if (!formData) return;

  let modifier = Number.parseInt(formData.modifier, 10);
  if (!Number.isInteger(modifier)) modifier = 0;

    const dicePool = Math.max(0, basePool + equipmentBonus + modifier);

  const classicInitial = await rollD6(dicePool);
  const stressInitial = await rollD6(stressDiceCount);

const state = {
  actorName: actor.name,
  actorUuid: actor.uuid,
  skillLabel: skillLabel || SKILL_LABELS[skillKey] || skillKey,
  attributeLabel,
  attributeKey,
  skillKey,
  attributeValue,
  skillValue,
  modifier,
  equipmentBonus,
  weaponName,
  dicePool,
  stressDiceCount,
  classicInitial,
  stressInitial,
  classicRerolls: [],
  stressRerolls: [],
  classicRerolls2: [],
  stressRerolls2: [],
  forceCount: 0,
  secondForceMode: null,
  forced: false
};

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: renderSkillCard(state),
    flags: {
      metro2033: {
        skillCheck: state
      }
    }
  });
}


async function forceSkillRoll(message) {
  const state = message.getFlag("metro2033", "skillCheck");
  if (!state) return;

  const forceCount = Number(state.forceCount ?? (state.forced ? 1 : 0));

  // Premier forçage : relancer tous les dés qui n'ont pas fait 6.
  if (forceCount === 0) {
    const classicToReroll = state.classicInitial.filter(
      value => value !== 6
    ).length;

    const stressToReroll = state.stressInitial.filter(
      value => value !== 6
    ).length;

    if (classicToReroll + stressToReroll === 0) return;

    const classicRerolls = await rollD6(classicToReroll);
    const stressRerolls = await rollD6(stressToReroll);

    const forcedState = {
      ...state,
      forced: true,
      forceCount: 1,
      classicRerolls,
      stressRerolls,
      classicRerolls2: [],
      stressRerolls2: [],
      secondForceMode: null
    };

    await message.update({
      content: renderSkillCard(forcedState),
      "flags.metro2033.skillCheck": forcedState
    });

    return;
  }

  // Une seule relance supplémentaire est permise après le premier forçage.
  if (forceCount !== 1) return;

  const actor = state.actorUuid
    ? await fromUuid(state.actorUuid)
    : null;

  const stressField = getNextStressField(actor);

  const stressOption = stressField
    ? `
      <option value="stress">
        Prendre un dé de Stress (cocher la prochaine case)
      </option>
    `
    : "";

  const choice = await foundry.applications.api.DialogV2.input({
    window: {
      title: "Re-forcer le jet"
    },
    content: `
      <p>Comment veux-tu forcer ce jet une seconde fois ?</p>

      <label>
        <span>Mode de forçage</span>
        <select name="method">
          <option value="talent">
            Talent ou aptitude : relancer les dés 2 à 5
          </option>
          <option value="talentSuperior">
            Talent supérieur : relancer aussi les 1 du premier forçage
          </option>
          ${stressOption}
        </select>
      </label>

      <p>
        Choisis la règle correspondant au talent ou à l'aptitude utilisé.
        Le second forçage sera le dernier pour ce jet.
      </p>
    `,
    ok: {
      label: "Re-forcer"
    },
    rejectClose: false,
    modal: true
  });

  if (!choice) return;

  const method = choice.method;

  // Chaque mode indique quels dés du premier forçage peuvent être relancés.
  const canReroll = value => {
    if (method === "talent") return value >= 2 && value <= 5;
    if (method === "talentSuperior") return value >= 1 && value <= 5;
    if (method === "stress") return value !== 6;
    return false;
  };

  const classicToReroll = state.classicRerolls.filter(
    canReroll
  ).length;

  const stressToReroll = state.stressRerolls.filter(
    canReroll
  ).length;

  const extraStressDie = method === "stress" ? 1 : 0;

  if (
    classicToReroll + stressToReroll + extraStressDie === 0
  ) {
    ui.notifications.warn(
      "Aucun dé ne peut être relancé avec cette option."
    );
    return;
  }

  // Prendre du Stress coche la prochaine case disponible sur le PJ.
  if (method === "stress") {
    const nextStressField = getNextStressField(actor);

    if (!actor || !nextStressField) {
      ui.notifications.warn(
        "Aucune case de Stress n'est disponible pour ce re-forçage."
      );
      return;
    }

    await actor.update({
      [`system.stress.${nextStressField}`]: true
    });
  }

  const classicRerolls2 = await rollD6(classicToReroll);
  const stressRerolls2 = await rollD6(
    stressToReroll + extraStressDie
  );

  const forcedState = {
    ...state,
    forced: true,
    forceCount: 2,
    classicRerolls2,
    stressRerolls2,
    secondForceMode: method
  };

  await message.update({
    content: renderSkillCard(forcedState),
    "flags.metro2033.skillCheck": forcedState
  });
}


export function registerSkillRollChatHook() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const state = message.getFlag("metro2033", "skillCheck");
    if (!state) return;

    const forceCount = Number(state.forceCount ?? (state.forced ? 1 : 0));
    if (forceCount >= 2) return;

    const button = html.querySelector("[data-metro-force-skill]");
    if (!button) return;

    const authorId = message.author?.id
      ?? (typeof message.user === "string" ? message.user : message.user?.id);

    if (authorId !== game.user.id && !game.user.isGM) {
      button.disabled = true;
      button.title = "Seul l'auteur du jet ou le MJ peut forcer ce jet.";
      return;
    }

    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();

      if (forcingInProgress.has(message.id)) return;

      forcingInProgress.add(message.id);
      button.disabled = true;

      try {
        await forceSkillRoll(message);
      } catch (error) {
        console.error("Métro 2033 | Erreur lors du jet forcé", error);
        ui.notifications.error("Impossible de forcer ce jet. Consulte la console.");
      } finally {
        forcingInProgress.delete(message.id);
      }
    });
  });
}
