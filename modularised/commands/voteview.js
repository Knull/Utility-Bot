// commands/voteview.js

const { SlashCommandBuilder } = require('discord.js');
const { handleVoteViewCommand } = require('../handlers/voting/voteviewHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voteview')
        .setDescription('View the votes for a specific poll.')
        // 1. Required User Option
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user who created the poll.')
                .setRequired(true)
        )
        // 2. Required Type Option
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of poll (e.g., pups, pugs).')
                .setRequired(true) // Changed to required
                .addChoices(
                    { name: 'PUPS', value: 'pups' },
                    { name: 'PUGS', value: 'pugs' },
                    // Add other types as needed
                )
        ),
    
    /**
     * Executes the command.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await handleVoteViewCommand(interaction);
    },
};
