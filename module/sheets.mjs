import { promptSkillRoll } from "./skill-rolls.mjs";
import { rollReserve } from "./inventory.mjs";


/**
 * Permet de modifier l'image d'un objet avec le sélecteur natif Foundry.
 */
function activateItemImagePicker(root, item) {
  const image = root.querySelector(
    '.metro-item-illustration img[data-edit="img"]'
  );

  if (!image) return;

  image.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    const picker = new foundry.applications.apps.FilePicker({
      type: "image",
      current: item.img,

      callback: async path => {
        if (!path) return;

        try {
          await item.update({ img: path });
        } catch (error) {
          console.error(
            "Métro 2033 | Impossible de modifier l'image de l'objet",
            error
          );

          ui.notifications.error(
            "Impossible d'enregistrer cette image."
          );
        }
      }
    });

    picker.render({ force: true });
  });
}


/**
 * Ouvre le sélecteur d'images natif pour le portrait d'un acteur.
 */
function activateActorImagePicker(root, actor) {
  const image = root.querySelector(".metro-portrait img");

  if (!image) return;

  image.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    const picker = new foundry.applications.apps.FilePicker({
      type: "image",
      current: actor.img,

      callback: async path => {
        if (!path) return;

        try {
          await actor.update({ img: path });
        } catch (error) {
          console.error(
            "Métro 2033 | Erreur lors du changement de portrait",
            error
          );

          ui.notifications.error(
            "Impossible de modifier le portrait."
          );
        }
      }
    });

    picker.render({ force: true });
  });
}


const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2, ItemSheetV2 } = foundry.applications.sheets;

export class MetroPlayerSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["metro2033", "metro2033-player-sheet"],
    position: {
      width: 960,
      height: 820
    },
    window: {
        resizable: true
    },
    form: {
      ...super.DEFAULT_OPTIONS.form,
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    main: {
      template: "systems/metro2033/templates/actor/player.hbs"
    }
  };



async _prepareContext(options) {
  const context = await super._prepareContext(options);
  const items = Array.from(this.actor.items);

  const aptitudes = items
    .filter(item => item.type === "aptitude")
    .sort((a, b) => a.sort - b.sort);

  const genericItems = items
    .filter(item => item.type === "generic")
    .sort((a, b) => a.sort - b.sort)
    .map(item => ({
      id: item.id,
      name: item.name,
      img: item.img,
      system: item.system,
      totalEncumbrance: Math.max(0, Number(item.system.encumbrance) || 0)
        * Math.max(1, Number(item.system.quantity) || 1)
    }));

  const weaponItems = items
    .filter(item => item.type === "weapon")
    .sort((a, b) => a.sort - b.sort)
    .map(item => ({
      id: item.id,
      name: item.name,
      img: item.img,
      system: item.system
    }));

  const armorItems = items
    .filter(item => item.type === "armor")
    .sort((a, b) => a.sort - b.sort)
    .map(item => ({
    id: item.id,
    name: item.name,
    img: item.img,
    system: item.system,
    isHelmet: item.system.slot === "casque"
    }));


  // Encombrement des objets transportés.
  const genericLoad = genericItems.reduce(
    (total, item) => total + item.totalEncumbrance, 0
  );

  const weaponLoad = weaponItems.reduce(
    (total, item) => total + Math.max(0, Number(item.system.encumbrance) || 0), 0
  );

  const armorLoad = armorItems.reduce(
    (total, item) => total + Math.max(0, Number(item.system.encumbrance) || 0), 0
  );

  // Les réserves d'eau et de nourriture.
  const reserves = this.actor.system.reserves ?? {};
  const reserveLevel = key => Math.max(
    0,
    Math.min(10, Number(reserves[key]) || 0)
  );

  const foodWaterLoad = level => {
    if (level === 0) return 0;
    if (level <= 4) return 1;
    if (level <= 6) return 2;
    return 3;
  };

  // Les filtres à air et l'énergie prennent moins de place.
  const airEnergyLoad = level => {
    if (level <= 3) return 0;
    if (level <= 5) return 1;
    if (level <= 8) return 2;
    return 3;
  };

  const reserveLoad =
    foodWaterLoad(reserveLevel("eau"))
    + foodWaterLoad(reserveLevel("nourriture"))
    + airEnergyLoad(reserveLevel("filtresAir"))
    + airEnergyLoad(reserveLevel("energie"));

  const totalLoad = genericLoad + weaponLoad + armorLoad + reserveLoad;

  const vigor = Math.max(0, Number(this.actor.system.vigueur?.value) || 0);
  const capacity = vigor * 2;

  const encumbrance = {
    total: Number(totalLoad.toFixed(2)),
    capacity,
    reserveLoad,
    genericLoad: Number(genericLoad.toFixed(2)),
    weaponLoad: Number(weaponLoad.toFixed(2)),
    armorLoad: Number(armorLoad.toFixed(2)),
    isOver: totalLoad > capacity
  };

  return {
    ...context,
    actor: this.actor,
    system: this.actor.system,
    aptitudes,
    genericItems,
    weaponItems,
    armorItems,
    encumbrance
  };
}




async _onDropItem(event, item) {
  const target = event.target instanceof Element ? event.target : null;

  const aptitudeZone = target?.closest("[data-aptitude-dropzone]");
  const itemZone = target?.closest("[data-item-dropzone]");

  let allowedType = null;

  if (aptitudeZone) {
    allowedType = "aptitude";
  } else if (itemZone) {
    allowedType = itemZone.dataset.itemDropzone;
  }

  if (!allowedType) return null;

  if (item.type !== allowedType) {
    ui.notifications.warn(
      `Cette zone accepte uniquement les objets de type « ${allowedType} ».`
    );
    return null;
  }

  const createdItem = await super._onDropItem(event, item);

  if (createdItem) {
    await this.render();
  }

  return createdItem;
}


  async _onRender(context, options) {
    await super._onRender(context, options);
    activateActorImagePicker(this.element, this.actor);

    const root = this.element;
    const activateTab = (tabName) => {
      root.querySelectorAll("[data-metro-tab]").forEach((button) => {
        const active = button.dataset.metroTab === tabName;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });

      root.querySelectorAll("[data-metro-panel]").forEach((panel) => {
        const active = panel.dataset.metroPanel === tabName;
        panel.classList.toggle("is-active", active);
        panel.hidden = !active;
      });
    };

    root.querySelectorAll("[data-metro-tab]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        this._activeMetroTab = button.dataset.metroTab;
        activateTab(this._activeMetroTab);
      });
    });

root.querySelectorAll(
  "[data-open-aptitude], [data-open-item]"
).forEach(button => {
  button.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();

    const itemId = button.dataset.openItem
      ?? button.dataset.openAptitude;

    const item = this.actor.items.get(itemId);

    if (item) {
      await item.sheet.render({ force: true });
    }
  });
});

root.querySelectorAll(
  "[data-remove-aptitude], [data-remove-item]"
).forEach(button => {
  button.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();

    const itemId = button.dataset.removeItem
      ?? button.dataset.removeAptitude;

    const item = this.actor.items.get(itemId);

    if (!item) return;

    const allowedTypes = ["aptitude", "generic", "weapon", "armor"];

    if (!allowedTypes.includes(item.type)) return;

    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
    await this.render();
  });
});

    root.querySelectorAll(".metro-skill").forEach(row => {
    row.addEventListener("click", async event => {
        // Le clic sur la case numérique doit rester utilisable normalement.
        if (event.target.closest("input")) return;

        const input = row.querySelector(
        'input[name^="system."][name*=".skills."]'
        );

        if (!input) return;

        const path = input.name.split(".");
        if (path.length !== 4) return;

        event.preventDefault();
        event.stopPropagation();

        const attributeKey = path[1];
        const skillKey = path[3];

        const skillLabel = Array.from(row.childNodes)
        .find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
        ?.textContent.trim()
        || skillKey;

        try {
        await promptSkillRoll(
            this.actor,
            attributeKey,
            skillKey,
            skillLabel
        );
        } catch (error) {
        console.error("Métro 2033 | Erreur lors du jet de compétence", error);
        ui.notifications.error("Impossible de lancer ce jet. Consulte la console.");
        }
    });
    });

    
    root.querySelectorAll("[data-reserve-roll]").forEach(button => {
    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();

        try {
        await rollReserve(
            this.actor,
            button.dataset.reserveRoll
        );
        } catch (error) {
        console.error("Métro 2033 | Erreur de jet de réserve", error);
        ui.notifications.error(
            "Impossible d'effectuer le jet de réserve. Consulte la console."
        );
        }
    });
    });
    
    root.querySelectorAll("[data-attack-weapon]").forEach(button => {
    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();

        const item = this.actor.items.get(button.dataset.attackWeapon);

        if (!item || item.type !== "weapon") return;

        const isMelee = item.system.attackSkill === "corpsMelee";
        const attributeKey = isMelee ? "vigueur" : "agilite";
        const skillKey = isMelee ? "corpsMelee" : "tir";

        try {
        await promptSkillRoll(
            this.actor,
            attributeKey,
            skillKey,
            `${isMelee ? "Corps à corps" : "Tir"} avec ${item.name}`,
            {
            equipmentBonus: item.system.bonus,
            weaponName: item.name
            }
        );
        } catch (error) {
        console.error("Métro 2033 | Erreur d'attaque depuis l'inventaire", error);
        ui.notifications.error("Impossible de lancer l'attaque.");
        }
    });
    });
    
    root.querySelectorAll("[data-roll-protection]").forEach(button => {
    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();

        const armor = this.actor.items.filter(item => item.type === "armor");

        if (!armor.length) return;

        // La valeur du casque et celle de l'armure se cumulent.
        const pool = armor.reduce(
        (total, item) => total + Math.max(0, Number(item.system.protection) || 0),
        0
        );

        const names = armor.map(item => item.name).join(" + ");

        try {
        const roll = pool > 0
            ? await new foundry.dice.Roll(`${pool}d6`).evaluate()
            : null;

        const results = roll?.terms?.[0]?.results?.map(
            result => Number(result.result)
        ) ?? [];

        const successes = results.filter(value => value === 6).length;
        const ones = results.filter(value => value === 1).length;

        const diceHTML = results.map((value, index) => {
            const classes = ["metro-roll-die", "metro-roll-die-normal"];
            if (value === 6) classes.push("is-success");
            if (value === 1) classes.push("is-affliction");

            return `<span class="${classes.join(" ")}" title="Dé ${index + 1}">${value}</span>`;
        }).join("");

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `
            <article class="metro-chat-armor-roll">
                <h2>Jet de protection</h2>
                <p><strong>Protections :</strong> ${foundry.utils.escapeHTML(names)}</p>
                <p><strong>Valeur totale :</strong> ${pool}</p>
                <div class="metro-roll-dice">${diceHTML || "<em>Aucun dé à lancer.</em>"}</div>
                <p><strong>Réussites :</strong> ${successes}</p>
                <p><strong>Résultats de 1 :</strong> ${ones}</p>
                <p class="metro-roll-explanation">
                Chaque réussite réduit les dégâts de 1. Les résultats de 1 signalent une dégradation éventuelle.
                Le jet ne peut pas être forcé ; les dégâts, la résilience et la dégradation restent à appliquer manuellement.
                </p>
            </article>
            `
        });
        } catch (error) {
        console.error("Métro 2033 | Erreur du jet de protection depuis l'inventaire", error);
        ui.notifications.error("Impossible d'effectuer le jet de protection.");
        }
    });
    });




    activateTab(this._activeMetroTab ?? "general");
  }
}


export class MetroNpcSheet extends MetroPlayerSheet {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: ["metro2033", "metro2033-npc-sheet"],
    position: {
      width: 900,
      height: 760
    }
  };

  static PARTS = {
    main: {
      template: "systems/metro2033/templates/actor/npc.hbs"
    }
  };
}


export class MetroAptitudeSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["metro2033", "metro2033-aptitude-sheet"],
    position: {
      width: 560,
      height: 540
    },
    window: {
      resizable: true
    },
    form: {
      ...super.DEFAULT_OPTIONS.form,
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    main: {
      template: "systems/metro2033/templates/item/aptitude.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    return {
      ...context,
      item: this.item,
      system: this.item.system
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const button = this.element.querySelector(
      '[data-action="publish-aptitude"]'
    );

    button?.addEventListener("click", async (event) => {
      event.preventDefault();

      const nameInput = this.element.querySelector('input[name="name"]');
      const descriptionInput = this.element.querySelector(
        'textarea[name="system.description"]'
      );

      const name = nameInput?.value.trim() || this.item.name;
      const description = descriptionInput?.value.trim() || "";

      await this.item.update({
        name,
        "system.description": description
      });

      const safeName = foundry.utils.escapeHTML(name);
      const safeDescription = foundry.utils
        .escapeHTML(description)
        .replace(/\r?\n/g, "<br>");

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({
          actor: this.item.parent
        }),
        content: `
          <article class="metro-chat-aptitude">
            <h2>${safeName}</h2>
            <div>${safeDescription || "<em>Aucune description.</em>"}</div>
          </article>
        `
      });
    });
  }
}



export class MetroGenericItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["metro2033", "metro2033-generic-item-sheet"],
    position: {
      width: 560,
      height: 620
    },
    window: {
      resizable: true
    },
    form: {
      ...super.DEFAULT_OPTIONS.form,
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    main: {
      template: "systems/metro2033/templates/item/generic.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    return {
      ...context,
      item: this.item,
      system: this.item.system
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    activateItemImagePicker(this.element, this.item);

    const button = this.element.querySelector(
      '[data-action="publish-generic-item"]'
    );

    button?.addEventListener("click", async (event) => {
      event.preventDefault();

      const name = this.element
        .querySelector('input[name="name"]')
        ?.value.trim() || this.item.name;

      const description = this.element
        .querySelector('textarea[name="system.description"]')
        ?.value.trim() || "";

      const quantityInput = this.element.querySelector(
        'input[name="system.quantity"]'
      );

      const encumbranceInput = this.element.querySelector(
        'input[name="system.encumbrance"]'
      );

      const quantity = Math.max(
        1,
        Number.parseInt(quantityInput?.value ?? "1", 10) || 1
      );

      const encumbrance = Math.max(
        0,
        Number(encumbranceInput?.value ?? 1) || 0
      );

      // Enregistrer les dernières valeurs saisies avant la publication.
      await this.item.update({
        name,
        "system.description": description,
        "system.quantity": quantity,
        "system.encumbrance": encumbrance
      });

      const safeName = foundry.utils.escapeHTML(name);
      const safeDescription = foundry.utils
        .escapeHTML(description)
        .replace(/\r?\n/g, "<br>");

      const totalEncumbrance = quantity * encumbrance;

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({
          actor: this.item.parent
        }),
        content: `
          <article class="metro-chat-generic-item">
            <h2>${safeName}</h2>
            <div class="metro-chat-item-description">
              ${safeDescription || "<em>Aucune description.</em>"}
            </div>
            <hr>
            <p><strong>Quantité :</strong> ${quantity}</p>
            <p><strong>Encombrement par objet :</strong> ${encumbrance}</p>
            <p><strong>Encombrement total :</strong> ${totalEncumbrance}</p>
          </article>
        `
      });
    });
  }
}


export class MetroWeaponSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["metro2033", "metro2033-weapon-sheet"],
    position: {
      width: 620,
      height: 760
    },
    window: {
      resizable: true
    },
    form: {
      ...super.DEFAULT_OPTIONS.form,
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    main: {
      template: "systems/metro2033/templates/item/weapon.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    return {
      ...context,
      item: this.item,
      system: this.item.system,
      isOwned: this.item.parent?.documentName === "Actor",
      isTir: this.item.system.attackSkill === "tir",
      isMelee: this.item.system.attackSkill === "corpsMelee",
      isGrip1M: this.item.system.grip === "1M",
      isGrip2M: this.item.system.grip === "2M",
      isGripFlexible: this.item.system.grip === "1M/2M"
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const root = this.element;
    activateItemImagePicker(root, this.item);

    const publishButton = root.querySelector(
      '[data-action="publish-weapon"]'
    );

    publishButton?.addEventListener("click", async event => {
      event.preventDefault();

      const readValue = selector =>
        root.querySelector(selector)?.value ?? "";

      const readNumber = selector =>
        Math.max(0, Number(readValue(selector)) || 0);

      const name = readValue('input[name="name"]').trim()
        || this.item.name;

      const description = readValue(
        'textarea[name="system.description"]'
      ).trim();

      const grip = readValue('[name="system.grip"]');
      const attackSkill = readValue('[name="system.attackSkill"]');
      const bonus = Math.floor(readNumber('[name="system.bonus"]'));
      const damage = Math.floor(readNumber('[name="system.damage"]'));
      const reliability = Math.floor(
        readNumber('[name="system.reliability"]')
      );
      const range = readValue('[name="system.range"]').trim();
      const encumbrance = readNumber('[name="system.encumbrance"]');
      const explosive = Boolean(
        root.querySelector('[name="system.explosive"]')?.checked
      );

      await this.item.update({
        name,
        "system.description": description,
        "system.grip": grip,
        "system.attackSkill": attackSkill,
        "system.bonus": bonus,
        "system.damage": damage,
        "system.reliability": reliability,
        "system.range": range,
        "system.encumbrance": encumbrance,
        "system.explosive": explosive
      });

      const safe = value => foundry.utils.escapeHTML(String(value ?? ""));
      const safeDescription = safe(description).replace(/\r?\n/g, "<br>");
      const damageText = explosive ? `${damage} (E)` : String(damage);
      const skillText = attackSkill === "corpsMelee"
        ? "Corps à corps"
        : "Tir";

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({
          actor: this.item.parent?.documentName === "Actor"
            ? this.item.parent
            : null
        }),
        content: `
          <article class="metro-chat-weapon">
            <h2>${safe(name)}</h2>
            ${safeDescription
              ? `<p>${safeDescription}</p>`
              : "<p><em>Aucune description.</em></p>"}
            <hr>
            <div class="metro-weapon-chat-grid">
              <p><strong>Prise :</strong> ${safe(grip)}</p>
              <p><strong>Compétence :</strong> ${skillText}</p>
              <p><strong>Bonus :</strong> +${bonus} dé(s)</p>
              <p><strong>Dégâts :</strong> ${damageText}</p>
              <p><strong>Fiabilité :</strong> ${reliability}</p>
              <p><strong>Portée :</strong> ${safe(range)}</p>
              <p><strong>Encombrement :</strong> ${encumbrance}</p>
            </div>
          </article>
        `
      });
    });

    const attackButton = root.querySelector(
      '[data-action="attack-weapon"]'
    );

    attackButton?.addEventListener("click", async event => {
      event.preventDefault();

      const actor = this.item.parent?.documentName === "Actor"
        ? this.item.parent
        : null;

      if (!actor) {
        ui.notifications.info(
          "Ajoute d'abord cette arme à l'inventaire d'un personnage pour effectuer une attaque."
        );
        return;
      }

      const attackSkill = this.item.system.attackSkill || "tir";
      const isMelee = attackSkill === "corpsMelee";

      const attributeKey = isMelee ? "vigueur" : "agilite";
      const skillLabel = isMelee
        ? `Corps à corps avec ${this.item.name}`
        : `Tir avec ${this.item.name}`;

      try {
        await promptSkillRoll(
          actor,
          attributeKey,
          attackSkill,
          skillLabel,
          {
            equipmentBonus: this.item.system.bonus,
            weaponName: this.item.name
          }
        );
      } catch (error) {
        console.error("Métro 2033 | Erreur d'attaque", error);
        ui.notifications.error(
          "Impossible de lancer l'attaque. Consulte la console."
        );
      }
    });
  }
}

export class MetroArmorSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["metro2033", "metro2033-armor-sheet"],
    position: {
      width: 580,
      height: 700
    },
    window: {
      resizable: true
    },
    form: {
      ...super.DEFAULT_OPTIONS.form,
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    main: {
      template: "systems/metro2033/templates/item/armor.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    return {
      ...context,
      item: this.item,
      system: this.item.system,
      isHelmet: this.item.system.slot === "casque",
      isBodyArmor: this.item.system.slot === "armure"
    };
  }

  _readFields() {
    const root = this.element;

    const readValue = selector =>
      root.querySelector(selector)?.value ?? "";

    const readNumber = selector =>
      Math.max(0, Number(readValue(selector)) || 0);

    return {
      name: readValue('input[name="name"]').trim() || this.item.name,
      description: readValue(
        'textarea[name="system.description"]'
      ).trim(),
      protection: Math.floor(
        readNumber('[name="system.protection"]')
      ),
      resilience: Boolean(
        root.querySelector('[name="system.resilience"]')?.checked
      ),
      slot: readValue('[name="system.slot"]'),
      encumbrance: readNumber('[name="system.encumbrance"]')
    };
  }

  async _saveFields() {
    const data = this._readFields();

    await this.item.update({
      name: data.name,
      "system.description": data.description,
      "system.protection": data.protection,
      "system.resilience": data.resilience,
      "system.slot": data.slot,
      "system.encumbrance": data.encumbrance
    });

    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const root = this.element;
    activateItemImagePicker(root, this.item);

    const publishButton = root.querySelector(
      '[data-action="publish-armor"]'
    );

    publishButton?.addEventListener("click", async event => {
      event.preventDefault();

      const data = await this._saveFields();
      const safe = value => foundry.utils.escapeHTML(String(value ?? ""));
      const safeDescription = safe(data.description).replace(
        /\r?\n/g,
        "<br>"
      );

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({
          actor: this.item.parent?.documentName === "Actor"
            ? this.item.parent
            : null
        }),
        content: `
          <article class="metro-chat-armor">
            <h2>${safe(data.name)}</h2>
            <p>${safeDescription || "<em>Aucune description.</em>"}</p>
            <hr>
            <p><strong>Type :</strong> ${
              data.slot === "casque" ? "Casque" : "Armure corporelle"
            }</p>
            <p><strong>Protection :</strong> ${data.protection}</p>
            <p><strong>Résilience :</strong> ${
              data.resilience ? "Oui" : "Non"
            }</p>
            <p><strong>Encombrement :</strong> ${data.encumbrance}</p>
          </article>
        `
      });
    });

    const rollButton = root.querySelector(
      '[data-action="roll-protection"]'
    );

    rollButton?.addEventListener("click", async event => {
      event.preventDefault();

      try {
        const data = await this._saveFields();
        const pool = Math.max(0, data.protection);

        const roll = pool > 0
          ? await new foundry.dice.Roll(`${pool}d6`).evaluate()
          : null;

        const results = roll?.terms?.[0]?.results?.map(
        result => Number(result.result)
        ) ?? [];

        const successes = results.filter(value => value === 6).length;
        const ones = results.filter(value => value === 1).length;

        const diceHTML = results.length
          ? results.map((value, index) => {
              const classes = ["metro-roll-die", "metro-roll-die-normal"];

              if (value === 6) classes.push("is-success");
              if (value === 1) classes.push("is-affliction");

              return `<span class="${classes.join(" ")}" title="Dé ${index + 1}">${value}</span>`;
            }).join("")
          : '<em>Aucun dé à lancer.</em>';

        const safeName = foundry.utils.escapeHTML(data.name);

        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({
            actor: this.item.parent?.documentName === "Actor"
              ? this.item.parent
              : null
          }),
          content: `
            <article class="metro-chat-armor-roll">
              <h2>Jet de protection — ${safeName}</h2>
              <p>${pool} dé(s) lancés, sans possibilité de forcer.</p>
              <div class="metro-roll-dice">${diceHTML}</div>
              <p><strong>Réussites :</strong> ${successes}</p>
              <p><strong>Résultats de 1 :</strong> ${ones} — dégradation éventuelle à appliquer manuellement.</p>
              <p class="metro-roll-explanation">
                Chaque réussite permet de réduire les dégâts subis de 1.
                Les dégâts et l'éventuelle dégradation de la protection restent à gérer manuellement.
              </p>
            </article>
          `
        });
      } catch (error) {
        console.error("Métro 2033 | Erreur du jet de protection", error);
        ui.notifications.error(
          "Impossible de lancer le jet de protection. Consulte la console."
        );
      }
    });
  }
}
