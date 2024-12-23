// commands/translation_unblacklist.js
const { SlashCommandBuilder } = require('discord.js');
const { handleTranslationUnblacklist } = require('../handlers/translationBlacklistHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('translation_unblacklist')
        .setDescription('Unblacklist a user manually')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to unblacklist')
                .setRequired(true)),
    
    async execute(interaction) {
        await handleTranslationUnblacklist(interaction, interaction.client);
    },
};
