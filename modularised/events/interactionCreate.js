// events/interactionCreate.js
const { Collection } = require('discord.js');
const pagination = require('../utilities/pagination');
const { handleButtonInteraction } = require('../handlers/buttonHandler');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}:`, error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        } else if (interaction.isButton()) {
            if (interaction.customId.startsWith('stafflist_')) {
                await pagination.handlePagination(interaction);
            } else if (interaction.customId.startsWith('unblacklist_')) {
                await handleButtonInteraction(interaction, client);
            }
            // Handle other button interactions here if necessary
        }
        // Handle other interaction types if necessary
    },
};
