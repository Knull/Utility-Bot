// commands/voteview.js

const { SlashCommandBuilder } = require('discord.js');
const { handleVoteViewCommand } = require('../handlers/voting/voteviewHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voteview')
        .setDescription('View the votes for a specific poll.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user who created the poll.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of poll (e.g., pups, pugs).')
                .setRequired(true) 
                .addChoices(
                    { name: 'PUPS', value: 'pups' },
                    { name: 'PUGS', value: 'pugs' },
                    // add other types as needed
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
