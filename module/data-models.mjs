
const { TypeDataModel } = foundry.abstract;
const { fields } = foundry.data;

const ATTRIBUTE_SKILLS = {
  vigueur: ["bricolage", "corpsMelee", "endurance"],
  agilite: ["furtivite", "reaction", "tir"],
  empathie: ["soins", "manipulation", "analyse"],
  esprit: ["survie", "observation", "comprehension"]
};


function createAttributeFields() {
  const attributes = {};

  for (const [attribute, skills] of Object.entries(ATTRIBUTE_SKILLS)) {
    attributes[attribute] = new fields.SchemaField({
      base: new fields.NumberField({
        required: true,
        integer: true,
        initial: 2,
        min: 0
      }),

      value: new fields.NumberField({
        required: true,
        integer: true,
        initial: 2,
        min: 0
      }),

      skills: new fields.SchemaField(
        Object.fromEntries(
          skills.map(skill => [
            skill,
            new fields.NumberField({
              required: true,
              integer: true,
              initial: 2,
              min: 0
            })
          ])
        )
      )
    });
  }

  return attributes;
}


function createCheckboxFields(names) {
  return Object.fromEntries(
    names.map(name => [
      name,
      new fields.BooleanField({
        required: true,
        initial: false
      })
    ])
  );
}

function numberedBoxes(prefix, count) {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);
}

// Données communes aux PJ et aux PNJ.
export class MetroCharacterData extends TypeDataModel {
  static defineSchema() {
    return createAttributeFields();
  }
}

// Données supplémentaires propres aux PJ.
export class MetroPlayerData extends MetroCharacterData {
  static defineSchema() {
    return {
      ...super.defineSchema(),

      archetype: new fields.StringField({
        required: true,
        initial: ""
      }),

      xp: new fields.NumberField({
        required: true,
        integer: true,
        initial: 0,
        min: 0
      }),
      
        reserves: new fields.SchemaField({
        eau: new fields.NumberField({
            required: true,
            integer: true,
            initial: 5,
            min: 0,
            max: 10
        }),

        nourriture: new fields.NumberField({
            required: true,
            integer: true,
            initial: 5,
            min: 0,
            max: 10
        }),

        filtresAir: new fields.NumberField({
            required: true,
            integer: true,
            initial: 5,
            min: 0,
            max: 10
        }),

        energie: new fields.NumberField({
            required: true,
            integer: true,
            initial: 5,
            min: 0,
            max: 10
        })
        }),

      
     criticalInjuries: new fields.StringField({
        required: true,
        initial: ""
        }),

     psychologicalTraumas: new fields.StringField({
        required: true,
        initial: ""
        }),

     biography: new fields.StringField({
        required: true,
        initial: ""
        }),


      conditions: new fields.SchemaField(
        createCheckboxFields([
          "affame",
          "deshydrate",
          "epuise",
          "gele"
        ])
      ),

      stress: new fields.SchemaField(
        createCheckboxFields(numberedBoxes("case", 5))
      ),

      sangFroid: new fields.SchemaField(
        createCheckboxFields([
          ...numberedBoxes("normal", 5),
          ...numberedBoxes("aptitude", 2)
        ])
      ),

      radiations: new fields.SchemaField(
        createCheckboxFields(numberedBoxes("case", 10))
      )
    };
  }
}


export class MetroAptitudeData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new foundry.data.fields.StringField({
        required: true,
        initial: ""
      })
    };
  }
}

export class MetroNpcData extends MetroCharacterData {
  static defineSchema() {
    return {
      ...super.defineSchema(),

      notes: new foundry.data.fields.StringField({
        required: true,
        initial: ""
      })
    };
  }
}

/**
 * Objet général : description, quantité et encombrement.
 */
export class MetroGenericItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new foundry.data.fields.StringField({
        required: true,
        initial: ""
      }),

      quantity: new foundry.data.fields.NumberField({
        required: true,
        integer: true,
        initial: 1,
        min: 1
      }),

      encumbrance: new foundry.data.fields.NumberField({
        required: true,
        initial: 1,
        min: 0
      })
    };
  }
}

/**
 * Arme : caractéristiques de l'arme et encombrement.
 */
export class MetroWeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new foundry.data.fields.StringField({
        required: true,
        initial: ""
      }),

      grip: new foundry.data.fields.StringField({
        required: true,
        initial: "1M"
      }),

      attackSkill: new foundry.data.fields.StringField({
        required: true,
        initial: "tir"
      }),

      bonus: new foundry.data.fields.NumberField({
        required: true,
        integer: true,
        initial: 0,
        min: 0
      }),

      damage: new foundry.data.fields.NumberField({
        required: true,
        integer: true,
        initial: 1,
        min: 0
      }),

      explosive: new foundry.data.fields.BooleanField({
        required: true,
        initial: false
      }),

      reliability: new foundry.data.fields.NumberField({
        required: true,
        integer: true,
        initial: 0,
        min: 0
      }),

      range: new foundry.data.fields.StringField({
        required: true,
        initial: "Moyenne"
      }),

      encumbrance: new foundry.data.fields.NumberField({
        required: true,
        initial: 1,
        min: 0
      })
    };
  }
}

/**
 * Protection : valeur de protection, résilience et encombrement.
 */
export class MetroArmorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new foundry.data.fields.StringField({
        required: true,
        initial: ""
      }),

      protection: new foundry.data.fields.NumberField({
        required: true,
        integer: true,
        initial: 1,
        min: 0
      }),

      resilience: new foundry.data.fields.BooleanField({
        required: true,
        initial: false
      }),

      slot: new foundry.data.fields.StringField({
        required: true,
        initial: "armure"
      }),

      encumbrance: new foundry.data.fields.NumberField({
        required: true,
        initial: 0,
        min: 0
      })
    };
  }
}
