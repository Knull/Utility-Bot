// events/interactionCreate.js
const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const buttonHandlers = require('../handlers/buttonHandlersRegistry');
const logger = require('../utilities/logger'); // Ensure this logger is properly implemented

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            if (interaction.isCommand()) {
                const commandPath = `../commands/${interaction.commandName}.js`;
                const fullCommandPath = path.resolve(__dirname, commandPath);

                // Check if the command file exists
                if (!fs.existsSync(fullCommandPath)) {
                    logger.warn(`Command file not found: ${commandPath}`);
                    return interaction.reply({
                        content: 'This command does not exist.',
                        ephemeral: true
                    });
                }

                const command = require(fullCommandPath);

                // Check if the command has an execute function
                if (!command.execute) {
                    logger.warn(`Execute function not found for command: ${interaction.commandName}`);
                    return interaction.reply({
                        content: 'This command is not implemented correctly.',
                        ephemeral: true
                    });
                }

                await command.execute(interaction);
            } else if (interaction.isButton()) {
                const customId = interaction.customId;
                logger.info(`Button Interaction Received: customId = ${customId}`);

                // Iterate through registered prefixes to find a match
                let handlerFound = false;
                for (const [prefix, handler] of Object.entries(buttonHandlers)) {
                    if (customId.startsWith(prefix)) {
                        logger.info(`Handler found for prefix: ${prefix}`);
                        await handler(interaction, customId); // Pass customId if needed
                        handlerFound = true;
                        break;
                    }
                }

                if (!handlerFound) {
                    logger.warn(`No handler found for button with customId: ${customId}`);
                    // Optionally, you can choose not to reply as per your preference
                    // To silently fail, you can do nothing or send a minimal ephemeral message
                    // Here, we'll send an ephemeral message as a fallback
                    return interaction.reply({ 
                        content: 'No handler was found for this button.', 
                        ephemeral: true 
                    });
                }
            } else if (interaction.isModalSubmit()) {
                const customId = interaction.customId;
                logger.info(`Modal Interaction Received: customId = ${customId}`);

                // Similar prefix matching for modals if needed
                let handlerFound = false;
                for (const [prefix, handler] of Object.entries(buttonHandlers)) {
                    if (customId.startsWith(prefix)) {
                        logger.info(`Handler found for prefix: ${prefix}`);
                        await handler(interaction, customId);
                        handlerFound = true;
                        break;
                    }
                }

                if (!handlerFound) {
                    logger.warn(`No handler found for modal with customId: ${customId}`);
                    return interaction.reply({ 
                        content: 'No handler was found for this modal.', 
                        ephemeral: true 
                    });
                }
            } else if (interaction.isAutocomplete()) { // **Added Autocomplete Handling**
                const commandName = interaction.commandName;
                logger.info(`Autocomplete Interaction Received for command: ${commandName}`);

                // Construct the path to the command file
                const commandPath = `../commands/${commandName}.js`;
                const fullCommandPath = path.resolve(__dirname, commandPath);

                // Check if the command file exists
                if (!fs.existsSync(fullCommandPath)) {
                    logger.warn(`Command file not found for autocomplete: ${commandPath}`);
                    return interaction.respond([]);
                }

                const command = require(fullCommandPath);

                // Check if the command has an autocomplete handler
                if (!command.autocomplete) {
                    logger.warn(`Autocomplete handler not found for command: ${commandName}`);
                    return interaction.respond([]);
                }

                await command.autocomplete(interaction);
            }
        } catch (error) {
            logger.error(`Error handling interaction: ${error}`);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ 
                    content: 'There was an error while executing this interaction!', 
                    ephemeral: true 
                });
            } else {
                await interaction.reply({ 
                    content: 'There was an error while executing this interaction!', 
                    ephemeral: true 
                });
            }
        }
    },
};
