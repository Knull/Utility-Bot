// commands/pugs.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const pugsVoteHandler = require('../handlers/voting/pugsVoteHandler');
const config = require('../config/config'); // Ensure config is imported

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pugs')
        .setDescription('PUGs related commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('vote')
                .setDescription('Vote for a user to join PUGs')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to vote for')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Type of PUGs vote')
                        .setRequired(true)
                        .addChoices(
                            { name: 'PUGs Trial', value: 'pugs_trial' },
                            { name: 'PUGs', value: 'pugs' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('myvote')
                .setDescription('Show your vote results'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add PUGs role to a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to add role to')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Type of PUGs role (trial or pugs)')
                        .setRequired(true)
                        .addChoices(
                            { name: 'PUGs Trial', value: 'pugs_trial' },
                            { name: 'PUGs', value: 'pugs' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove PUGs role from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to remove role from')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all users with PUGs roles')),
    
    async execute(interaction) {
        const { commandName, options } = interaction;

        if (commandName === 'pugs') {
            const subcommand = options.getSubcommand();

            switch (subcommand) {
                case 'vote':
                    await pugsVoteHandler.handleVote(interaction);
                    break;
                case 'myvote':
                    await pugsVoteHandler.handleMyVote(interaction);
                    break;
                case 'add':
                    await pugsVoteHandler.handleAdd(interaction);
                    break;
                case 'remove':
                    await pugsVoteHandler.handleRemove(interaction);
                    break;
                case 'list':
                    await pugsVoteHandler.handleList(interaction);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        }
    },
};
