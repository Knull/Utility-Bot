// events/interactionCreate.js
const { Collection } = require('discord.js');
const pagination = require('../utilities/pagination'); // If you have a pagination utility
const { handleButtonInteraction } = require('../handlers/buttonHandler');
const { handlePromoteCommand, handlePremiumList } = require('../handlers/premiumHandler');

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
        } else if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);

            if (!command || !command.autocomplete) return;

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error(`Error handling autocomplete for ${interaction.commandName}:`, error);
                await interaction.respond([{ name: 'Error fetching suggestions', value: 'none' }]);
            }
        } else if (interaction.isButton()) {
            await handleButtonInteraction(interaction, client);
        }
        // Handle other interaction types if necessary
    },
};
