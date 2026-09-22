'use strict';

const { MessageFlags } = require('discord.js');
const { isOwner } = require('../utils/permissions');
const { ACTIONS, SENSITIVITY_PRESETS } = require('../config/defaults');
const views = require('../panel/views');
const { buildLadderStepModal, buildCustomThresholdModal } = require('../panel/modals');
const logger = require('../utils/logger');

const VIEW_BUILDERS = {
  home: (config) => views.buildHomeView(config),
  punishments: (config) => views.buildPunishmentsView(config),
  settings: (config) => views.buildSettingsView(config),
  logchannel: (config) => views.buildLogChannelView(config),
  strikes: (config, strikes) => views.buildStrikesView(config, strikes),
};

function renderView(viewName, configStore, strikesStore) {
  const builder = VIEW_BUILDERS[viewName] || VIEW_BUILDERS.home;
  return builder(configStore.get(), strikesStore.get());
}

async function denyIfNotOwner(interaction) {
  if (isOwner(interaction.user.id)) return false;
  await interaction.reply({ content: '⛔ You are not authorized to use this panel.', flags: MessageFlags.Ephemeral });
  return true;
}

function sortLadder(ladder) {
  return [...ladder].sort((a, b) => a.strikes - b.strikes);
}

async function replyError(interaction, message) {
  await interaction.reply({ content: `❌ ${message}`, flags: MessageFlags.Ephemeral });
}

function registerInteractionHandlers(client, { configStore, strikesStore }) {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isButton()) {
        await handleButton(interaction, configStore, strikesStore);
      } else if (interaction.isStringSelectMenu()) {
        await handleStringSelect(interaction, configStore, strikesStore);
      } else if (interaction.isChannelSelectMenu()) {
        await handleChannelSelect(interaction, configStore, strikesStore);
      } else if (interaction.isUserSelectMenu()) {
        await handleUserSelect(interaction, configStore, strikesStore);
      } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction, configStore, strikesStore);
      }
    } catch (err) {
      logger.error('interaction', 'Unhandled error while processing interaction:', err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction
          .reply({ content: '❌ Something went wrong handling that. Check the logs.', flags: MessageFlags.Ephemeral })
          .catch(() => {});
      }
    }
  });
}

// ── Buttons ──────────────────────────────────────────────────────────────
async function handleButton(interaction, configStore, strikesStore) {
  if (!interaction.customId.startsWith('panel:')) return;
  if (await denyIfNotOwner(interaction)) return;

  const parts = interaction.customId.split(':'); // panel:<section>:<action>[:<extra>]
  const [, section, action, extra] = parts;

  if (section === 'nav') {
    return interaction.update({ components: renderView(action, configStore, strikesStore), flags: MessageFlags.IsComponentsV2 });
  }

  if (section === 'refresh') {
    return interaction.update({ components: renderView(action, configStore, strikesStore), flags: MessageFlags.IsComponentsV2 });
  }

  if (section === 'toggle' && action === 'enabled') {
    configStore.update((c) => ({ ...c, enabled: !c.enabled }));
    return interaction.update({ components: renderView('home', configStore, strikesStore), flags: MessageFlags.IsComponentsV2 });
  }

  if (section === 'toggle' && action === 'deleteOnFlag') {
    configStore.update((c) => ({ ...c, deleteOnFlag: !c.deleteOnFlag }));
    return interaction.update({ components: renderView('settings', configStore, strikesStore), flags: MessageFlags.IsComponentsV2 });
  }

  if (section === 'ladder' && action === 'add') {
    return interaction.showModal(buildLadderStepModal({}));
  }

  if (section === 'ladder' && action === 'edit') {
    const idx = Number(extra);
    const ladder = sortLadder(configStore.get().ladder);
    const existing = ladder[idx];
    if (!existing) return replyError(interaction, 'That step no longer exists — refresh the panel.');
    return interaction.showModal(buildLadderStepModal({ index: idx, existing }));
  }

  if (section === 'ladder' && action === 'remove') {
    const idx = Number(extra);
    configStore.update((c) => {
      const ladder = sortLadder(c.ladder);
      ladder.splice(idx, 1);
      return { ...c, ladder };
    });
    return interaction.update({ components: renderView('punishments', configStore, strikesStore), flags: MessageFlags.IsComponentsV2 });
  }

  if (section === 'strikes' && action === 'resetall') {
    strikesStore.update(() => ({}));
    return interaction.update({ components: renderView('strikes', configStore, strikesStore), flags: MessageFlags.IsComponentsV2 });
  }
}

// ── String select (sensitivity preset) ──────────────────────────────────
async function handleStringSelect(interaction, configStore, strikesStore) {
  if (!interaction.customId.startsWith('panel:')) return;
  if (await denyIfNotOwner(interaction)) return;

  if (interaction.customId === 'panel:threshold:select') {
    const choice = interaction.values[0];
    if (choice === 'Custom') {
      const currentPercent = Math.round(configStore.get().threshold * 100);
      return interaction.showModal(buildCustomThresholdModal(currentPercent));
    }
    const value = SENSITIVITY_PRESETS[choice];
    configStore.update((c) => ({ ...c, threshold: value, sensitivityLabel: choice }));
    return interaction.update({ components: renderView('settings', configStore, strikesStore), flags: MessageFlags.IsComponentsV2 });
  }
}

// ── Channel select (log channel) ────────────────────────────────────────
async function handleChannelSelect(interaction, configStore, strikesStore) {
  if (!interaction.customId.startsWith('panel:')) return;
  if (await denyIfNotOwner(interaction)) return;

  if (interaction.customId === 'panel:logchannel:select') {
    const channelId = interaction.values[0];
    configStore.update((c) => ({ ...c, logChannelId: channelId }));
    return interaction.update({ components: renderView('logchannel', configStore, strikesStore), flags: MessageFlags.IsComponentsV2 });
  }
}

// ── User select (reset one user's strikes) ──────────────────────────────
async function handleUserSelect(interaction, configStore, strikesStore) {
  if (!interaction.customId.startsWith('panel:')) return;
  if (await denyIfNotOwner(interaction)) return;

  if (interaction.customId === 'panel:strikes:resetuser') {
    const userId = interaction.values[0];
    strikesStore.update((data) => {
      delete data[userId];
      return data;
    });
    return interaction.update({ components: renderView('strikes', configStore, strikesStore), flags: MessageFlags.IsComponentsV2 });
  }
}

// ── Modals ───────────────────────────────────────────────────────────────
async function handleModalSubmit(interaction, configStore, strikesStore) {
  if (!interaction.customId.startsWith('panel:')) return;
  if (await denyIfNotOwner(interaction)) return;

  if (interaction.customId === 'panel:threshold:modal') {
    const raw = interaction.fields.getTextInputValue('threshold').trim();
    const percent = Number(raw);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return replyError(interaction, 'Threshold must be a number between 0 and 100.');
    }
    configStore.update((c) => ({ ...c, threshold: percent / 100, sensitivityLabel: 'Custom' }));
    if (interaction.isFromMessage()) {
      return interaction.update({ components: renderView('settings', configStore, strikesStore), flags: MessageFlags.IsComponentsV2 });
    }
    return interaction.reply({ content: '✅ Custom threshold saved.', flags: MessageFlags.Ephemeral });
  }

  if (interaction.customId === 'panel:ladder:modal:add' || interaction.customId.startsWith('panel:ladder:modal:edit:')) {
    const isEdit = interaction.customId.startsWith('panel:ladder:modal:edit:');
    const editIndex = isEdit ? Number(interaction.customId.split(':')[4]) : null;

    const strikesRaw = interaction.fields.getTextInputValue('strikes').trim();
    const actionRaw = interaction.fields.getTextInputValue('action').trim().toLowerCase();
    const durationRaw = interaction.fields.getTextInputValue('duration')?.trim();

    const strikeCount = Number(strikesRaw);
    if (!Number.isInteger(strikeCount) || strikeCount < 1) {
      return replyError(interaction, 'Strike count must be a whole number of 1 or more.');
    }
    if (!ACTIONS.includes(actionRaw)) {
      return replyError(interaction, `Action must be one of: ${ACTIONS.join(', ')}.`);
    }

    let durationMinutes;
    if (actionRaw === 'timeout') {
      durationMinutes = Number(durationRaw);
      const MAX_TIMEOUT_MINUTES = 40320; // Discord's 28-day timeout cap
      if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > MAX_TIMEOUT_MINUTES) {
        return replyError(interaction, `Timeout duration must be a whole number of minutes between 1 and ${MAX_TIMEOUT_MINUTES} (28 days).`);
      }
    }

    const newStep = { strikes: strikeCount, action: actionRaw, ...(durationMinutes ? { durationMinutes } : {}) };

    configStore.update((c) => {
      const ladder = sortLadder(c.ladder);
      if (isEdit) {
        if (!ladder[editIndex]) return c; // stale index, ignore silently
        ladder[editIndex] = newStep;
      } else {
        // Replace any existing step with the same strike count rather than duplicating it.
        const dupeIdx = ladder.findIndex((s) => s.strikes === strikeCount);
        if (dupeIdx >= 0) ladder[dupeIdx] = newStep;
        else ladder.push(newStep);
      }
      return { ...c, ladder: sortLadder(ladder) };
    });

    if (interaction.isFromMessage()) {
      return interaction.update({ components: renderView('punishments', configStore, strikesStore), flags: MessageFlags.IsComponentsV2 });
    }
    return interaction.reply({ content: '✅ Punishment step saved.', flags: MessageFlags.Ephemeral });
  }
}

module.exports = { registerInteractionHandlers };
