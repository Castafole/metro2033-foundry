
import {
  MetroCharacterData,
  MetroPlayerData,
  MetroNpcData,
  MetroAptitudeData,
  MetroGenericItemData,
  MetroWeaponData,
  MetroArmorData
} from "./module/data-models.mjs";

import {
  MetroPlayerSheet,
  MetroNpcSheet,
  MetroAptitudeSheet,
  MetroGenericItemSheet,
  MetroWeaponSheet,
  MetroArmorSheet
} from "./module/sheets.mjs";

import {
  MetroCombat,
  registerMetroInitiativeButton
} from "./module/initiative.mjs";

import { registerSkillRollChatHook } from "./module/skill-rolls.mjs";
import { registerTerrorAttackTools } from "./module/terror.mjs";

Hooks.once("init", () => {
  CONFIG.Actor.dataModels.player = MetroPlayerData;
  CONFIG.Actor.dataModels.npc = MetroNpcData;

  CONFIG.Item.dataModels.aptitude = MetroAptitudeData;

  CONFIG.Item.dataModels.generic = MetroGenericItemData;
  CONFIG.Item.dataModels.weapon = MetroWeaponData;
  CONFIG.Item.dataModels.armor = MetroArmorData;

  CONFIG.Combat.documentClass = MetroCombat;
    registerMetroInitiativeButton();
    registerTerrorAttackTools();

  const DocumentSheetConfig =
    foundry.applications.apps.DocumentSheetConfig;

  DocumentSheetConfig.registerSheet(
    foundry.documents.Actor,
    "metro2033",
    MetroPlayerSheet,
    {
      types: ["player"],
      makeDefault: true,
      label: "Métro 2033 — Personnage joueur"
    }
  );

  DocumentSheetConfig.registerSheet(
    foundry.documents.Actor,
    "metro2033",
    MetroNpcSheet,
    {
      types: ["npc"],
      makeDefault: true,
      label: "Métro 2033 — PNJ"
    }
  );

  DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    "metro2033",
    MetroAptitudeSheet,
    {
      types: ["aptitude"],
      makeDefault: true,
      label: "Métro 2033 — Aptitude"
    }
  );
  
  DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    "metro2033",
    MetroGenericItemSheet,
    {
        types: ["generic"],
        makeDefault: true,
        label: "Métro 2033 — Objet général"
    }
    );
    
    DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    "metro2033",
    MetroWeaponSheet,
    {
        types: ["weapon"],
        makeDefault: true,
        label: "Métro 2033 — Arme"
    }
    );

    DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    "metro2033",
    MetroArmorSheet,
    {
        types: ["armor"],
        makeDefault: true,
        label: "Métro 2033 — Protection"
    }
    );



  registerSkillRollChatHook();
  console.log("Métro 2033 | Modèles et fiches chargés");
});
