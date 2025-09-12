// events/interactionCreate.js
// i would not recommmend changing this, only do so if you know what you're doing
const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const buttonHandlers = require('../handlers/buttonHandlersRegistry');
const logger = require('../utilities/logger'); 

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            if (interaction.isCommand()) {
                const commandPath = `../commands/${interaction.commandName}.js`;
                const fullCommandPath = path.resolve(__dirname, commandPath);
                if (!fs.existsSync(fullCommandPath)) {
                    logger.warn(`Command file not found: ${commandPath}`);
                    return interaction.reply({
                        content: 'This command does not exist.',
                        ephemeral: true
                    });
                }

                const command = require(fullCommandPath);
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
                    return interaction.reply({ 
                        content: 'No handler was found for this button.', 
                        ephemeral: true 
                    });
                }
            } else if (interaction.isModalSubmit()) {
                const customId = interaction.customId;
                logger.info(`Modal Interaction Received: customId = ${customId}`);
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
                const commandPath = `../commands/${commandName}.js`;
                const fullCommandPath = path.resolve(__dirname, commandPath);
                if (!fs.existsSync(fullCommandPath)) {
                    logger.warn(`Command file not found for autocomplete: ${commandPath}`);
                    return interaction.respond([]);
                }

                const command = require(fullCommandPath);
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
