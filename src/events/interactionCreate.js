module.exports = {
    name: 'interactionCreate',
    async execute(client, interaction) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'There was an error executing that command.', ephemeral: true });
            }
        } else if (interaction.isButton()) {
            // Handle button interactions
            // You can have separate handler files or delegate to feature handlers
            // For example:
            // await require('../features/buttonHandler').handle(client, interaction);
        } else if (interaction.isModalSubmit()) {
            // Handle modal submissions
            // You can delegate to feature-specific handlers
            // For example:
            // await require('../features/modalHandler').handle(client, interaction);
        } else if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (command && command.autocomplete) {
                try {
                    await command.autocomplete(interaction);
                } catch (error) {
                    console.error(error);
                }
            }
        }
    }
};
