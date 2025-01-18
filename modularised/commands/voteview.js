// commands/voteview.js

const { SlashCommandBuilder } = require('discord.js');
const { handleVoteViewCommand, handleVoteViewAutocomplete } = require('../handlers/voting/voteviewHandler');

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
            option.setName('vote_id')
                .setDescription('The ID of the poll.')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    
    /**
     * Executes the command.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await handleVoteViewCommand(interaction);
    },
    
    /**
     * Handles autocomplete for the vote_id option.
     * @param {AutocompleteInteraction} interaction 
     */
    async autocomplete(interaction) {
        await handleVoteViewAutocomplete(interaction);
    },
};
