// handlers/voting/voteviewHandler.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { pool } = require('../../utilities/database');
const logger = require('../../utilities/logger');
const config = require('../../config/config'); // Importing config

const allowedRoles = [
    config.pupsManagerRoleId,
    config.premiumManagerRoleId,
    config.pugsManagerRoleId
    // Add more role IDs if necessary
];

/**
 * Handle the `/voteview` command
 * @param {CommandInteraction} interaction 
 */
const handleVoteViewCommand = async (interaction) => {
    const user = interaction.options.getUser('user');
    const type = interaction.options.getString('type');

    if (!user || !type) {
        const embed = new EmbedBuilder()
            .setDescription('Please provide both a user and a type.')
            .setColor(0x980e00) // Red color for errors
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if the command executor has at least one of the allowed roles
    const executorMember = interaction.member;
    const hasCommandRole = executorMember.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!hasCommandRole) {
        const embed = new EmbedBuilder()
            .setDescription('No Permissions!\n> You must have one of the following roles to use this command:')
            .addFields(
                { name: 'Roles', value: allowedRoles.map(roleId => `<@&${roleId}>`).join('\n') }
            )
            .setColor(0xFF0000) // Red color for errors
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
        // Fetch all polls for the specified user and type
        const query = 'SELECT id, type, active, created_at FROM polls WHERE user_id = ? AND type = ? ORDER BY created_at DESC';
        const params = [user.id, type.toLowerCase()];
        logger.info(`Executing query: ${query} with params: ${JSON.stringify(params)}`);
        const [polls] = await pool.execute(query, params);
        logger.info(`Number of polls fetched: ${polls.length}`);

        if (polls.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('No polls found for the specified user and type.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Initialize pagination
        const currentPage = 0;
        const totalPages = polls.length;

        // Display the first poll
        const embed = createPollEmbed(interaction, user, type, polls[currentPage], currentPage, totalPages);
        const buttons = createNavigationButtons(interaction, type, currentPage, totalPages);

        await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
    } catch (error) {
        logger.error('Error fetching polls:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while fetching the polls.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

/**
 * Create an embed for a specific poll
 * @param {CommandInteraction} interaction 
 * @param {User} user 
 * @param {string} type 
 * @param {Object} poll 
 * @param {number} currentPage 
 * @param {number} totalPages 
 * @returns {EmbedBuilder}
 */
const createPollEmbed = (interaction, user, type, poll, currentPage, totalPages) => {
    const pollStatus = poll.active ? 'active' : 'inactive';
    const pollTypeUpper = type.toUpperCase();

    const embed = new EmbedBuilder()
        .setAuthor({ 
            name: `${user.username} | ${pollTypeUpper} Vote`, 
            iconURL: user.displayAvatarURL() 
        })
        .setDescription(`This poll is currently **\`${pollStatus}\`**`)
        .addFields(
            { name: 'Poll ID', value: `\`${poll.id}\``, inline: true }
        )
        .setFooter({ 
            text: `Poll ${currentPage + 1}/${totalPages} • ${new Date(poll.created_at).toLocaleString()}`,
            iconURL: user.displayAvatarURL()
        })
        .setColor('#FFD700') // Gold color
        .setTimestamp();

    return embed;
};

/**
 * Create navigation buttons
 * @param {CommandInteraction} interaction 
 * @param {string} type 
 * @param {number} currentPage 
 * @param {number} totalPages 
 * @returns {ActionRowBuilder}
 */
const createNavigationButtons = (interaction, type, currentPage, totalPages) => {
    const userId = interaction.options.getUser('user').id;

    const prevButton = new ButtonBuilder()
        .setCustomId(`voteview_prev_${userId}_${type}_${currentPage}`)
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === 0 || totalPages === 1);

    const viewVotesButton = new ButtonBuilder()
        .setCustomId(`voteview_viewvotes_${userId}_${type}_${currentPage}`)
        .setLabel('View Votes')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔍');

    const nextButton = new ButtonBuilder()
        .setCustomId(`voteview_next_${userId}_${type}_${currentPage}`)
        .setEmoji('➡️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === totalPages - 1 || totalPages === 1);

    const actionRow = new ActionRowBuilder()
        .addComponents(prevButton, viewVotesButton, nextButton);

    return actionRow;
};

/**
 * Handle Previous Button Interaction
 * @param {ButtonInteraction} interaction 
 */
const handlePrevButton = async (interaction) => {
    const customId = interaction.customId; // e.g., voteview_prev_USERID_TYPE_CURRENTPAGE
    const parts = customId.split('_');
    if (parts.length !== 5) {
        logger.warn(`Invalid customId for previous button: ${customId}`);
        return interaction.reply({ content: 'Invalid interaction.', ephemeral: true });
    }

    const userId = parts[2];
    const type = parts[3];
    let currentPage = parseInt(parts[4], 10);

    if (isNaN(currentPage) || currentPage <= 0) {
        logger.warn(`Invalid page number in customId: ${customId}`);
        return interaction.reply({ content: 'Invalid page number.', ephemeral: true });
    }

    currentPage -= 1;

    try {
        // Fetch all polls again
        const query = 'SELECT id, type, active, created_at FROM polls WHERE user_id = ? AND type = ? ORDER BY created_at DESC';
        const params = [userId, type.toLowerCase()];
        const [polls] = await pool.execute(query, params);

        if (polls.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('No polls found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.update({ embeds: [embed], components: [] });
        }

        const totalPages = polls.length;
        const poll = polls[currentPage];
        const user = await interaction.client.users.fetch(userId);

        const embed = createPollEmbed(interaction, user, type, poll, currentPage, totalPages);
        const buttons = createNavigationButtons(interaction, type, currentPage, totalPages);

        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        logger.error('Error handling previous button:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while navigating polls.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.update({ embeds: [embed], components: [] });
    }
};

/**
 * Handle Next Button Interaction
 * @param {ButtonInteraction} interaction 
 */
const handleNextButton = async (interaction) => {
    const customId = interaction.customId; // e.g., voteview_next_USERID_TYPE_CURRENTPAGE
    const parts = customId.split('_');
    if (parts.length !== 5) {
        logger.warn(`Invalid customId for next button: ${customId}`);
        return interaction.reply({ content: 'Invalid interaction.', ephemeral: true });
    }

    const userId = parts[2];
    const type = parts[3];
    let currentPage = parseInt(parts[4], 10);

    if (isNaN(currentPage)) {
        logger.warn(`Invalid page number in customId: ${customId}`);
        return interaction.reply({ content: 'Invalid page number.', ephemeral: true });
    }

    currentPage += 1;

    try {
        // Fetch all polls again
        const query = 'SELECT id, type, active, created_at FROM polls WHERE user_id = ? AND type = ? ORDER BY created_at DESC';
        const params = [userId, type.toLowerCase()];
        const [polls] = await pool.execute(query, params);

        if (polls.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('No polls found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.update({ embeds: [embed], components: [] });
        }

        const totalPages = polls.length;
        if (currentPage >= totalPages) {
            logger.warn(`Current page exceeds total pages: ${currentPage} >= ${totalPages}`);
            return interaction.reply({ content: 'No more polls.', ephemeral: true });
        }

        const poll = polls[currentPage];
        const user = await interaction.client.users.fetch(userId);

        const embed = createPollEmbed(interaction, user, type, poll, currentPage, totalPages);
        const buttons = createNavigationButtons(interaction, type, currentPage, totalPages);

        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        logger.error('Error handling next button:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while navigating polls.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.update({ embeds: [embed], components: [] });
    }
};

/**
 * Handle View Votes Button Interaction
 * @param {ButtonInteraction} interaction 
 */
const handleViewVotesButton = async (interaction) => {
    const customId = interaction.customId; // e.g., voteview_viewvotes_USERID_TYPE_CURRENTPAGE
    const parts = customId.split('_');
    if (parts.length !== 5) {
        logger.warn(`Invalid customId for view votes button: ${customId}`);
        return interaction.reply({ content: 'Invalid interaction.', ephemeral: true });
    }

    const userId = parts[2];
    const type = parts[3];
    const currentPage = parseInt(parts[4], 10);

    try {
        // Fetch all polls
        const query = 'SELECT id, type, active, created_at FROM polls WHERE user_id = ? AND type = ? ORDER BY created_at DESC';
        const params = [userId, type.toLowerCase()];
        const [polls] = await pool.execute(query, params);

        if (polls.length === 0 || currentPage >= polls.length) {
            const embed = new EmbedBuilder()
                .setDescription('Poll not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const poll = polls[currentPage];

        // Determine which handler to use based on poll type
        if (poll.type.toLowerCase() === 'pups') {
            return handleViewVotesPups(interaction, poll);
        } else if (poll.type.toLowerCase() === 'pugs') {
            const pugsVoteHandler = require('./pugsVoteHandler');
            if (pugsVoteHandler.handleViewVotes) {
                return pugsVoteHandler.handleViewVotes(interaction, poll);
            }
        } else {
            const embed = new EmbedBuilder()
                .setDescription('Unknown poll type.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // If no appropriate handler found
        const embed = new EmbedBuilder()
            .setDescription('No handler found for this poll type.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        logger.error('Error handling view votes button:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while fetching the votes.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

/**
 * Handle Viewing Votes for PUPS
 * @param {ButtonInteraction} interaction 
 * @param {Object} poll 
 */
const handleViewVotesPups = async (interaction, poll) => {
    try {
        // Fetch poll details with all columns
        const [polls] = await pool.execute('SELECT * FROM polls WHERE id = ? AND type = "pups"', [poll.id]);
        if (polls.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('Poll not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], components: [] });
        }

        const pollDetails = polls[0];

        // Fetch upvoters and downvoters
        const [upvoters] = await pool.execute('SELECT user_id FROM votes WHERE poll_id = ? AND vote = "upvote"', [poll.id]);
        const [downvoters] = await pool.execute('SELECT user_id FROM votes WHERE poll_id = ? AND vote = "downvote"', [poll.id]);

        // Format mentions without code blocks
        const upvoteMentions = upvoters.length > 0 
            ? upvoters.map(v => `• <@${v.user_id}>`).join('\n') 
            : '• No upvotes yet.';
        const downvoteMentions = downvoters.length > 0 
            ? downvoters.map(v => `• <@${v.user_id}>`).join('\n') 
            : '• No downvotes yet.';

        // Fetch poll owner details using pollDetails.user_id
        let pollOwner;
        try {
            pollOwner = await interaction.guild.members.fetch(pollDetails.user_id);
            logger.info(`Poll owner fetched: ${pollOwner.user.username}`);
        } catch (err) {
            pollOwner = null;
            logger.error(`Poll owner with ID ${pollDetails.user_id} not found.`);
        }

        // Fetch all polls for the user and type, sorted descendingly by creation date
        const [allPolls] = await pool.execute(
            'SELECT id FROM polls WHERE user_id = ? AND type = ? ORDER BY created_at DESC',
            [pollDetails.user_id, 'pups']
        );

        const totalPolls = allPolls.length;
        const currentPollIndex = allPolls.findIndex(p => p.id === poll.id) + 1; // +1 to make it 1-based index

        if (currentPollIndex === 0) {
            // Poll ID not found in the user's poll list
            logger.warn(`Poll ID ${poll.id} not found in the user's poll list.`);
            const embed = new EmbedBuilder()
                .setDescription('Poll not found in your poll list.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], components: [] });
        }

        // Determine poll status based on 'active' column
        const pollStatus = poll.active ? 'active' : 'inactive';

        // Check permissions: user is the poll owner or has an allowed role
        const member = interaction.member; // GuildMember
        const isOwner = member.id === pollDetails.user_id;
        const hasRole = member.roles.cache.some(role => allowedRoles.includes(role.id));

        if (!isOwner && !hasRole) {
            const embed = new EmbedBuilder()
                .setDescription('No Permissions!\n> Only <@' + pollDetails.user_id + '> can click this button, or people with these roles:\n' +
                    allowedRoles.map(roleId => `<@&${roleId}>`).join('\n'))
                .setColor(0xFF0000) // Red color
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], components: [] });
        }

        // Create embed as per specifications
        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: pollOwner ? pollOwner.user.username : 'Unknown User', 
                iconURL: pollOwner ? pollOwner.user.displayAvatarURL() : interaction.guild.iconURL() 
            })
            .addFields(
                { name: 'Upvotes 👍', value: upvoteMentions, inline: true },
                { name: 'Downvotes 💔', value: downvoteMentions, inline: true }
            )
            .setFooter({ 
                text: `Poll ${currentPollIndex}/${totalPolls}`,
                iconURL: pollOwner ? pollOwner.user.displayAvatarURL() : interaction.guild.iconURL()
            })
            .setColor('#FFD700') // Gold color for results
            .setTimestamp();

        // Create navigation buttons (disabled since we're viewing votes)
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`voteview_prev_pups_${pollDetails.user_id}_pups_${currentPollIndex - 1}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPollIndex === 1),
                new ButtonBuilder()
                    .setCustomId(`voteview_viewvotes_${pollDetails.user_id}_pups_${currentPollIndex - 1}`)
                    .setLabel('View Votes')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔍')
                    .setDisabled(true), // Disable if already viewing
                new ButtonBuilder()
                    .setCustomId(`voteview_next_pups_${pollDetails.user_id}_pups_${currentPollIndex - 1}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPollIndex === totalPolls)
            );

        await interaction.editReply({ embeds: [embed], components: [actionRow] });
    } catch (error) {
        logger.error('Error handling view votes for PUPS:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while viewing the votes.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed], components: [] });
    }
};

module.exports = {
    handleVoteViewCommand,
    handlePrevButton,
    handleNextButton,
    handleViewVotesButton,
    handleViewVotesPups,
};
