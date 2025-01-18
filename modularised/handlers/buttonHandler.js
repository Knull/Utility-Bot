// handlers/buttonHandler.js
const buttonHandlersRegistry = require('./buttonHandlersRegistry');

/**
 * Main function to handle all button interactions.
 * Routes the interaction to specific handlers based on the customId.
 * @param {Interaction} interaction 
 * @param {Client} client 
 */
async function handleButtonInteraction(interaction, client) {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    const prefix = customId.split('_')[0];

    const handler = buttonHandlersRegistry[prefix];

    if (handler) {
        await handler(interaction, client);
    } else {
        console.log(`Unhandled button interaction with customId: ${customId}`);
        // Optionally, inform the user about the unhandled button
        // await interaction.reply({ content: 'This button is not recognized.', ephemeral: true });
    }
}

module.exports = { handleButtonInteraction };
