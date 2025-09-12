const { SlashCommandBuilder } = require('discord.js');
const { handleUnlockCommand } = require('../handlers/unlockHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock the current ticket channel and restore original permissions.'),
    
    async execute(interaction) {
        await handleUnlockCommand(interaction, interaction.client);
    },
};
