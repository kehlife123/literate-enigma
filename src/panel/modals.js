'use strict';

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

/**
 * customId is either "panel:ladder:modal:add" or "panel:ladder:modal:edit:<index>".
 * `existing` pre-fills the fields when editing.
 */
function buildLadderStepModal({ index, existing }) {
  const isEdit = index !== undefined && index !== null;
  const modal = new ModalBuilder()
    .setCustomId(isEdit ? `panel:ladder:modal:edit:${index}` : 'panel:ladder:modal:add')
    .setTitle(isEdit ? 'Edit punishment step' : 'Add punishment step');

  const strikesInput = new TextInputBuilder()
    .setCustomId('strikes')
    .setLabel('Strike count that triggers this step')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 3')
    .setRequired(true);
  if (existing) strikesInput.setValue(String(existing.strikes));

  const actionInput = new TextInputBuilder()
    .setCustomId('action')
    .setLabel('Action: warn, timeout, kick, or ban')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('warn / timeout / kick / ban')
    .setRequired(true);
  if (existing) actionInput.setValue(existing.action);

  const durationInput = new TextInputBuilder()
    .setCustomId('duration')
    .setLabel('Timeout minutes (only if action = timeout)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 60')
    .setRequired(false);
  if (existing?.durationMinutes) durationInput.setValue(String(existing.durationMinutes));

  modal.addComponents(
    new ActionRowBuilder().addComponents(strikesInput),
    new ActionRowBuilder().addComponents(actionInput),
    new ActionRowBuilder().addComponents(durationInput)
  );
  return modal;
}

function buildCustomThresholdModal(currentThresholdPercent) {
  const modal = new ModalBuilder().setCustomId('panel:threshold:modal').setTitle('Custom sensitivity');
  const input = new TextInputBuilder()
    .setCustomId('threshold')
    .setLabel('Threshold % (0-100). Lower = stricter.')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 70')
    .setValue(String(currentThresholdPercent))
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

module.exports = { buildLadderStepModal, buildCustomThresholdModal };
