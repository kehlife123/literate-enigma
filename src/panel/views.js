'use strict';

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  UserSelectMenuBuilder,
  ChannelType,
} = require('discord.js');
const { SENSITIVITY_PRESETS } = require('../config/defaults');
const { describeStep, formatScore } = require('../utils/format');

const ACCENT = 0x2b6cb0;

function header(text) {
  return new TextDisplayBuilder().setContent(text);
}

function backRow(currentView) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('panel:nav:home').setLabel('⟵ Home').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`panel:refresh:${currentView}`).setLabel('↻ Refresh').setStyle(ButtonStyle.Secondary)
  );
}

// ── HOME ─────────────────────────────────────────────────────────────────
function buildHomeView(config) {
  const container = new ContainerBuilder().setAccentColor(ACCENT);
  container.addTextDisplayComponents(
    header(
      [
        '## 🛡️ Sentinel — Control Panel',
        `**Status:** ${config.enabled ? '🟢 Scanning' : '🔴 Paused'}`,
        `**Log channel:** ${config.logChannelId ? `<#${config.logChannelId}>` : '*Not set*'}`,
        `**Sensitivity:** ${config.sensitivityLabel} (flags at ≥ ${formatScore(config.threshold)})`,
        `**Delete on flag:** ${config.deleteOnFlag ? 'Yes' : 'No'}`,
        `**Punishment steps:** ${config.ladder.length}`,
      ].join('\n')
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel:toggle:enabled')
        .setLabel(config.enabled ? 'Pause scanning' : 'Resume scanning')
        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
    )
  );
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('panel:nav:punishments').setLabel('⚖️ Punishments').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('panel:nav:settings').setLabel('⚙️ Settings').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('panel:nav:logchannel').setLabel('📋 Log Channel').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('panel:nav:strikes').setLabel('🚩 Strikes').setStyle(ButtonStyle.Primary)
    )
  );
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('panel:refresh:home').setLabel('↻ Refresh').setStyle(ButtonStyle.Secondary)
    )
  );
  return [container];
}

// ── PUNISHMENTS ──────────────────────────────────────────────────────────
function buildPunishmentsView(config) {
  const container = new ContainerBuilder().setAccentColor(ACCENT);
  container.addTextDisplayComponents(
    header('## ⚖️ Punishment Ladder\nFires the matching action the moment a user reaches that exact strike count.')
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const ladder = [...config.ladder].sort((a, b) => a.strikes - b.strikes);
  if (ladder.length === 0) {
    container.addTextDisplayComponents(header('*No steps configured yet — every strike is silently logged only.*'));
  }

  ladder.forEach((step, idx) => {
    container.addTextDisplayComponents(header(`**${describeStep(step)}**`));
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`panel:ladder:edit:${idx}`).setLabel('Edit').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`panel:ladder:remove:${idx}`).setLabel('Remove').setStyle(ButtonStyle.Danger)
      )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  });

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('panel:ladder:add').setLabel('+ Add step').setStyle(ButtonStyle.Success)
    )
  );
  container.addActionRowComponents(backRow('punishments'));
  return [container];
}

// ── SETTINGS ─────────────────────────────────────────────────────────────
function buildSettingsView(config) {
  const container = new ContainerBuilder().setAccentColor(ACCENT);
  container.addTextDisplayComponents(header('## ⚙️ Settings'));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  container.addTextDisplayComponents(
    header(`**Scanning:** ${config.enabled ? 'On' : 'Off'}\n**Delete flagged messages:** ${config.deleteOnFlag ? 'On' : 'Off'}`)
  );
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel:toggle:enabled')
        .setLabel(config.enabled ? 'Turn scanning off' : 'Turn scanning on')
        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('panel:toggle:deleteOnFlag')
        .setLabel(config.deleteOnFlag ? 'Stop deleting flags' : 'Start deleting flags')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    header(`**Sensitivity:** ${config.sensitivityLabel} — flags content scoring ≥ ${formatScore(config.threshold)}`)
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId('panel:threshold:select')
    .setPlaceholder('Change sensitivity')
    .addOptions(
      ...Object.entries(SENSITIVITY_PRESETS).map(([label, value]) => ({
        label: `${label} (≥ ${formatScore(value)})`,
        value: label,
        default: config.sensitivityLabel === label,
      })),
      { label: 'Custom…', value: 'Custom', default: config.sensitivityLabel === 'Custom' }
    );
  container.addActionRowComponents(new ActionRowBuilder().addComponents(select));

  container.addActionRowComponents(backRow('settings'));
  return [container];
}

// ── LOG CHANNEL ──────────────────────────────────────────────────────────
function buildLogChannelView(config) {
  const container = new ContainerBuilder().setAccentColor(ACCENT);
  container.addTextDisplayComponents(
    header(
      `## 📋 Mod Log Channel\nCurrently: ${config.logChannelId ? `<#${config.logChannelId}>` : '*Not set*'}\nPick a text channel below to receive every flagged item with its score and the action taken.`
    )
  );
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('panel:logchannel:select')
        .setPlaceholder('Select the mod-log channel')
        .addChannelTypes(ChannelType.GuildText)
    )
  );
  container.addActionRowComponents(backRow('logchannel'));
  return [container];
}

// ── STRIKES ──────────────────────────────────────────────────────────────
function buildStrikesView(config, strikes) {
  const container = new ContainerBuilder().setAccentColor(ACCENT);
  container.addTextDisplayComponents(header('## 🚩 Strikes'));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const entries = Object.entries(strikes)
    .filter(([, v]) => v.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  if (entries.length === 0) {
    container.addTextDisplayComponents(header('*No strikes recorded yet.*'));
  } else {
    const lines = entries.map(([userId, v]) => `**<@${userId}>** — ${v.count} strike${v.count === 1 ? '' : 's'}`);
    container.addTextDisplayComponents(header(lines.join('\n')));
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(header('Reset a specific user, or clear everyone at once:'));
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId('panel:strikes:resetuser').setPlaceholder('Reset one user\u2019s strikes')
    )
  );
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('panel:strikes:resetall').setLabel('Reset all strikes').setStyle(ButtonStyle.Danger)
    )
  );
  container.addActionRowComponents(backRow('strikes'));
  return [container];
}

module.exports = {
  buildHomeView,
  buildPunishmentsView,
  buildSettingsView,
  buildLogChannelView,
  buildStrikesView,
};
