const { SlashCommandBuilder } = require('discord.js');
const { handleTranslationBlacklist } = require('../features/translationBlacklist');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('translation_blacklist')
        .setDescription('Blacklist a user for a set duration')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to blacklist')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration for the blacklist (e.g., "10m", "1h", "1d")')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for blacklisting the user')
                .setRequired(false)
        ),
    async execute(interaction) {
        await handleTranslationBlacklist(interaction);
    },
};
