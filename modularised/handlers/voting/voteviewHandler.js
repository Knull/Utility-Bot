// handlers/voting/voteviewHandler.js

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { pool } = require('../../utilities/database');
const logger = require('../../utilities/logger');
const config = require('../../config/config');

// Roles that can use /voteview
const allowedRoles = [
    config.pupsManagerRoleId,
    config.premiumManagerRoleId,
    config.pugsManagerRoleId
];

/**
 * Handle the `/voteview` slash command
 * @param {CommandInteraction} interaction 
 */
const handleVoteViewCommand = async (interaction) => {
    try {
        // Acknowledge the slash command
        await interaction.deferReply(); 

        const user = interaction.options.getUser('user');
        const typeInput = interaction.options.getString('type');

        // Basic validation
        if (!user || !typeInput) {
            const embed = new EmbedBuilder()
                .setDescription('Please provide both a user and a type.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        // Role check
        const executorMember = interaction.member;
        const hasCommandRole = executorMember.roles.cache.some(role => allowedRoles.includes(role.id));
        if (!hasCommandRole) {
            const embed = new EmbedBuilder()
                .setDescription('No Permissions!\n> You must have one of the following roles to use this command:')
                .addFields({
                    name: 'Roles', 
                    value: allowedRoles.map(roleId => `<@&${roleId}>`).join('\n')
                })
                .setColor(0xFF0000)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        // Validate type input
        const validTypes = ['pups', 'pugs', 'pugs_trial'];
        if (!validTypes.includes(typeInput.toLowerCase())) {
            const embed = new EmbedBuilder()
                .setDescription('Invalid type provided. Please choose either `pups`, `pugs`, or `pugs_trial`.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        // Decide which poll types to query
        let pollTypes = [];
        const lowered = typeInput.toLowerCase();
        if (lowered === 'pups') {
            pollTypes = ['pups'];
        } else if (lowered === 'pugs') {
            // user wants BOTH pugs + pugs_trial
            pollTypes = ['pugs', 'pugs_trial'];
        } else if (lowered === 'pugs_trial') {
            pollTypes = ['pugs_trial'];
        }

        // Build a dynamic IN (...) query for pollTypes
        const placeholders = pollTypes.map(() => '?').join(',');
        const query = `
            SELECT 
                id, user_id, type, active, created_at, upvotes, downvotes
            FROM polls
            WHERE user_id = ?
              AND type IN (${placeholders})
            ORDER BY created_at DESC
        `;
        const params = [user.id, ...pollTypes];
        logger.info(`Executing query: ${query} with params: ${JSON.stringify(params)}`);

        const [polls] = await pool.execute(query, params);
        logger.info(`Number of polls fetched: ${polls.length}`);

        if (polls.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('No polls found for the specified user and type.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        // Show first poll
        const currentPage = 0;
        const totalPages = polls.length;
        const firstPoll = polls[0];

        // Create the embed from the actual poll type
        const embed = createPollEmbed(interaction, user, firstPoll, currentPage, totalPages);
        // Build next/prev/view votes buttons
        const buttons = createNavigationButtons(user.id, pollTypes, currentPage, totalPages);

        // Send the final message (public by default, or ephemeral: true if you want)
        await interaction.editReply({ embeds: [embed], components: [buttons] });

    } catch (error) {
        logger.error('Error fetching polls:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while fetching the polls.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed], ephemeral: true });
    }
};

/**
 * Create an embed for a poll, using poll.type to pick color/text
 * @param {Interaction} interaction
 * @param {User} user
 * @param {Object} poll - The poll row
 * @param {number} currentPage
 * @param {number} totalPages
 */
function createPollEmbed(interaction, user, poll, currentPage, totalPages) {
    const pollIndexLabel = currentPage + 1; // 1-based
    const pollStatus = poll.active ? 'active' : 'inactive';

    // Determine color & heading
    let embedColor = '#e96d6d';
    let embedAuthorText = 'Vote';

    if (poll.type === 'pups') {
        const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);
        embedColor = pupsRole ? pupsRole.color : '#e96d6d';
        embedAuthorText = 'PUPS Vote';
    } else if (poll.type === 'pugs') {
        const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
        embedColor = pugsRole ? pugsRole.color : '#e96d6d';
        embedAuthorText = 'PUGS Vote';
    } else if (poll.type === 'pugs_trial') {
        const trialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);
        embedColor = trialRole ? trialRole.color : '#e96d6d';
        embedAuthorText = 'PUGS Trial Vote';
    }

    return new EmbedBuilder()
        .setAuthor({
            name: `${user.username} | ${embedAuthorText}`,
            iconURL: user.displayAvatarURL({ dynamic: true })
        })
        .setDescription(
            `- **Poll ID** (relative to user): \`${pollIndexLabel}\`\n` +
            `> This poll is currently __\`${pollStatus}\`__.\n`
        )
        .addFields(
            { name: 'Upvotes 👍',    value: `\`\`\`${poll.upvotes}\`\`\``,    inline: true },
            { name: 'Downvotes 👎', value: `\`\`\`${poll.downvotes}\`\`\``, inline: true }
        )
        .setFooter({
            text: `Poll ${pollIndexLabel}/${totalPages}`,
            iconURL: user.displayAvatarURL({ dynamic: true })
        })
        .setColor(embedColor)
        .setTimestamp();
}

/**
 * Create navigation buttons for the poll listing
 * @param {string} userId
 * @param {string[]} pollTypes - e.g. ["pugs","pugs_trial"] or ["pups"]
 * @param {number} currentPage
 * @param {number} totalPages
 * @returns {ActionRowBuilder}
 */
function createNavigationButtons(userId, pollTypes, currentPage, totalPages) {
    // Join pollTypes with + => "pugs+pugs_trial"
    // Then we store that in the customId along with the currentPage
    const pollTypesJoined = pollTypes.join('+');

    const prevDisabled = (currentPage === 0);
    const nextDisabled = (currentPage === totalPages - 1);

    const prevButton = new ButtonBuilder()
        .setCustomId(`voteview_prev_${userId}_${pollTypesJoined}_${currentPage}`)
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(prevDisabled);

    const viewVotesButton = new ButtonBuilder()
        .setCustomId(`voteview_viewvotes_${userId}_${pollTypesJoined}_${currentPage}`)
        .setLabel('View Votes')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔍');

    const nextButton = new ButtonBuilder()
        .setCustomId(`voteview_next_${userId}_${pollTypesJoined}_${currentPage}`)
        .setEmoji('➡️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(nextDisabled);

    return new ActionRowBuilder().addComponents(prevButton, viewVotesButton, nextButton);
}

/**
 * Handle the Previous Button Interaction
 * @param {ButtonInteraction} interaction
 */
const handlePrevButton = async (interaction) => {
    const customId = interaction.customId;
    // e.g. "voteview_prev_<userId>_pugs+pugs_trial_<page>"
    const parts = customId.split('_');

    // We need at least 5 parts for a valid customId
    if (parts.length < 5) {
        logger.warn(`Invalid customId for previous button: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid interaction.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const userId = parts[2];
    // The last part is currentPage
    let currentPage = parseInt(parts[parts.length - 1], 10);
    if (isNaN(currentPage)) {
        logger.warn(`Invalid page number in customId: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid page number.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // The middle chunk is pollTypesJoined
    // e.g. "pugs+pugs_trial"
    const pollTypesJoined = parts.slice(3, parts.length - 1).join('_');
    const pollTypesArray = pollTypesJoined.split('+');

    // Decrement page
    currentPage -= 1;
    if (currentPage < 0) currentPage = 0; // clamp

    try {
        // Re-fetch polls matching these types
        const placeholders = pollTypesArray.map(() => '?').join(',');
        const query = `
            SELECT id, user_id, type, active, created_at, upvotes, downvotes
            FROM polls
            WHERE user_id = ?
              AND type IN (${placeholders})
            ORDER BY created_at DESC
        `;
        const params = [userId, ...pollTypesArray];
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

        const embed = createPollEmbed(interaction, user, poll, currentPage, totalPages);
        const buttons = createNavigationButtons(userId, pollTypesArray, currentPage, totalPages);

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
 * Handle the Next Button Interaction
 * @param {ButtonInteraction} interaction
 */
const handleNextButton = async (interaction) => {
    const customId = interaction.customId;
    // e.g. "voteview_next_<userId>_pugs+pugs_trial_<page>"
    const parts = customId.split('_');

    if (parts.length < 5) {
        logger.warn(`Invalid customId for next button: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid interaction.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const userId = parts[2];
    let currentPage = parseInt(parts[parts.length - 1], 10);
    if (isNaN(currentPage)) {
        logger.warn(`Invalid page number in customId: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid page number.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Re-join middle chunk => pollTypes
    const pollTypesJoined = parts.slice(3, parts.length - 1).join('_');
    const pollTypesArray = pollTypesJoined.split('+');

    currentPage += 1;

    try {
        const placeholders = pollTypesArray.map(() => '?').join(',');
        const query = `
            SELECT 
                id, user_id, type, active, created_at, upvotes, downvotes
            FROM polls
            WHERE user_id = ?
              AND type IN (${placeholders})
            ORDER BY created_at DESC
        `;
        const params = [userId, ...pollTypesArray];
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
            const embed = new EmbedBuilder()
                .setDescription('No more polls.')
                .setColor(0xFFD700)
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const poll = polls[currentPage];
        const user = await interaction.client.users.fetch(userId);

        const embed = createPollEmbed(interaction, user, poll, currentPage, totalPages);
        const buttons = createNavigationButtons(userId, pollTypesArray, currentPage, totalPages);

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
 * Handle the View Votes Button Interaction
 * @param {ButtonInteraction} interaction
 */
const handleViewVotesButton = async (interaction) => {
    try {
        await interaction.deferReply({ ephemeral: true });

        const customId = interaction.customId;
        // e.g. "voteview_viewvotes_<userId>_pugs+pugs_trial_<page>"
        const parts = customId.split('_');
        if (parts.length < 5) {
            logger.warn(`Invalid customId for view votes button: ${customId}`);
            const embed = new EmbedBuilder()
                .setDescription('Invalid view votes interaction.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const userId = parts[2];
        const currentPage = parseInt(parts[parts.length - 1], 10);
        if (isNaN(currentPage)) {
            logger.warn(`Invalid page number: ${customId}`);
            const embed = new EmbedBuilder()
                .setDescription('Invalid page number.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Middle chunk => "pugs+pugs_trial" etc.
        const pollTypesJoined = parts.slice(3, parts.length - 1).join('_');
        const pollTypesArray = pollTypesJoined.split('+');

        // Re-fetch the same poll list
        const placeholders = pollTypesArray.map(() => '?').join(',');
        const query = `
            SELECT 
                id, user_id, type, active, created_at
            FROM polls
            WHERE user_id = ?
              AND type IN (${placeholders})
            ORDER BY created_at DESC
        `;
        const params = [userId, ...pollTypesArray];
        const [polls] = await pool.execute(query, params);

        if (polls.length === 0 || currentPage >= polls.length) {
            const embed = new EmbedBuilder()
                .setDescription('No polls found for this user and type, or invalid page.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const poll = polls[currentPage];
        // Route to the correct sub-handler
        if (poll.type === 'pups') {
            return handleViewVotesPups(interaction, poll);
        } else if (poll.type === 'pugs' || poll.type === 'pugs_trial') {
            return handleViewVotesPugs(interaction, poll);
        } else {
            const embed = new EmbedBuilder()
                .setDescription('Unknown poll type.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        logger.error('Error handling view votes button:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while fetching the votes.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }
};

/**
 * Handle Viewing Votes for PUPS
 * @param {ButtonInteraction} interaction 
 * @param {Object} poll  // includes id, user_id, type, etc.
 */
const handleViewVotesPups = async (interaction, poll) => {
    try {
        // We already deferred in handleViewVotesButton => only editReply here

        // Double-check the poll in DB
        const [pollRows] = await pool.execute(
            'SELECT * FROM polls WHERE id = ? AND type = "pups"',
            [poll.id]
        );
        if (pollRows.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('Poll not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], components: [] });
        }
        const pollDetails = pollRows[0];

        // Get up/down voters
        const [upvoters] = await pool.execute(
            'SELECT user_id FROM votes WHERE poll_id = ? AND vote = "upvote"',
            [poll.id]
        );
        const [downvoters] = await pool.execute(
            'SELECT user_id FROM votes WHERE poll_id = ? AND vote = "downvote"',
            [poll.id]
        );

        const upvoteMentions = upvoters.length
            ? upvoters.map(v => `- <@${v.user_id}>`).join('\n')
            : '• No upvotes yet.';
        const downvoteMentions = downvoters.length
            ? downvoters.map(v => `- <@${v.user_id}>`).join('\n')
            : '• No downvotes yet.';

        // Poll owner
        let pollOwner = null;
        try {
            pollOwner = await interaction.guild.members.fetch(pollDetails.user_id);
            logger.info(`Poll owner fetched: ${pollOwner.user.username}`);
        } catch (err) {
            logger.error(`Poll owner with ID ${pollDetails.user_id} not found.`);
        }

        // All polls for user + type = pups
        const [allPolls] = await pool.execute(
            'SELECT id FROM polls WHERE user_id = ? AND type = "pups" ORDER BY created_at DESC',
            [pollDetails.user_id]
        );
        const totalPolls = allPolls.length;
        const currentPollIndex = allPolls.findIndex(p => p.id === poll.id) + 1;
        if (currentPollIndex === 0) {
            logger.warn(`Poll ID ${poll.id} not found in user's poll list.`);
            const embed = new EmbedBuilder()
                .setDescription('Poll not found in your poll list.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], components: [] });
        }

        // Check permission: poll owner or has allowed role
        const member = interaction.member;
        const isOwner = (member.id === pollDetails.user_id);
        const hasRole = member.roles.cache.some(role => allowedRoles.includes(role.id));
        if (!isOwner && !hasRole) {
            const embed = new EmbedBuilder()
                .setTitle('No Permission!')
                .setDescription(
                    `> Only <@${pollDetails.user_id}> can click this button, or those with:\n` +
                    allowedRoles.map(r => `<@&${r}>`).join('\n')
                )
                .setColor(0xFF0000)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], components: [] });
        }

        // Color from pups role
        const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);
        const embedColor = pupsRole ? pupsRole.color : 0xFFD700;

        const embed = new EmbedBuilder()
            .setAuthor({
                name: pollOwner ? pollOwner.user.username : 'Unknown User',
                iconURL: pollOwner
                    ? pollOwner.user.displayAvatarURL()
                    : interaction.guild.iconURL()
            })
            .addFields(
                { name: 'Upvotes 👍',    value: upvoteMentions,    inline: true },
                { name: 'Downvotes 💔', value: downvoteMentions,  inline: true }
            )
            .setFooter({
                text: `Poll ${currentPollIndex}/${totalPolls}`,
                iconURL: pollOwner
                    ? pollOwner.user.displayAvatarURL()
                    : interaction.guild.iconURL()
            })
            .setColor(embedColor)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [] });
    } catch (error) {
        logger.error('Error handling view votes for PUPS:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while viewing the votes.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed], components: [] });
    }
};

/**
 * Handle Viewing Votes for PUGS and PUGS Trial
 * @param {ButtonInteraction} interaction 
 * @param {Object} poll 
 */
const handleViewVotesPugs = async (interaction, poll) => {
    try {
        const userId = poll.user_id;

        // Confirm poll belongs to userId and is pugs or pugs_trial
        const [pollRows] = await pool.execute(
            'SELECT * FROM polls WHERE id = ? AND user_id = ? AND (type = "pugs" OR type = "pugs_trial")',
            [poll.id, userId]
        );
        if (pollRows.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('Poll not found or does not belong to the specified user.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], components: [] });
        }

        const pollDetails = pollRows[0];

        // Fetch up/downvoters
        const [upvoters] = await pool.execute(
            'SELECT user_id FROM votes WHERE poll_id = ? AND vote = "upvote"',
            [poll.id]
        );
        const [downvoters] = await pool.execute(
            'SELECT user_id FROM votes WHERE poll_id = ? AND vote = "downvote"',
            [poll.id]
        );

        const upvoteMentions = upvoters.length
            ? upvoters.map(v => `- <@${v.user_id}>`).join('\n')
            : '• No upvotes yet.';
        const downvoteMentions = downvoters.length
            ? downvoters.map(v => `- <@${v.user_id}>`).join('\n')
            : '• No downvotes yet.';

        // Poll owner
        let pollOwner = null;
        try {
            pollOwner = await interaction.guild.members.fetch(pollDetails.user_id);
            logger.info(`Poll owner fetched: ${pollOwner.user.username}`);
        } catch (err) {
            logger.error(`Poll owner with ID ${pollDetails.user_id} not found.`);
        }

        // All pugs or pugs_trial polls for that user
        const [allPolls] = await pool.execute(
            'SELECT id FROM polls WHERE user_id = ? AND type IN ("pugs", "pugs_trial") ORDER BY created_at DESC',
            [pollDetails.user_id]
        );
        const totalPolls = allPolls.length;
        const currentPollIndex = allPolls.findIndex(p => p.id === poll.id) + 1;
        if (currentPollIndex === 0) {
            logger.warn(`Poll ID ${poll.id} not found in the user's poll list.`);
            const embed = new EmbedBuilder()
                .setDescription('Poll not found in your poll list.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], components: [] });
        }

        // Permission check
        const member = interaction.member;
        const isOwner = (member.id === pollDetails.user_id);
        const hasRole = member.roles.cache.some(r => allowedRoles.includes(r.id));
        if (!isOwner && !hasRole) {
            const embed = new EmbedBuilder()
                .setTitle('No Permission!')
                .setDescription(
                    `> Only <@${pollDetails.user_id}> can click this button, or those with:\n` +
                    allowedRoles.map(r => `<@&${r}>`).join('\n')
                )
                .setColor(0xFF0000)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], components: [] });
        }

        // Color for pugs or pugs_trial
        const roleId = (poll.type === 'pugs_trial') 
            ? config.pugsTrialRoleId 
            : config.pugsRoleId;
        const role = interaction.guild.roles.cache.get(roleId);
        const embedColor = role ? role.color : 0xFFD700;

        const embedAuthorText = (poll.type === 'pugs_trial')
            ? 'PUGS Trial Vote'
            : 'PUGS Vote';

        const embed = new EmbedBuilder()
            .setAuthor({
                name: pollOwner ? pollOwner.user.username : 'Unknown User',
                iconURL: pollOwner
                    ? pollOwner.user.displayAvatarURL()
                    : interaction.guild.iconURL()
            })
            .addFields(
                { name: 'Upvotes 👍',    value: upvoteMentions,    inline: true },
                { name: 'Downvotes 💔', value: downvoteMentions,  inline: true }
            )
            .setFooter({
                text: `Poll ${currentPollIndex}/${totalPolls}`,
                iconURL: pollOwner
                    ? pollOwner.user.displayAvatarURL()
                    : interaction.guild.iconURL()
            })
            .setColor(embedColor)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [] });
    } catch (error) {
        logger.error('Error handling view votes for PUGS:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while viewing the votes.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed], components: [] });
    }
};

// Export all handlers
module.exports = {
    handleVoteViewCommand,
    handlePrevButton,
    handleNextButton,
    handleViewVotesButton,
    handleViewVotesPups,
    handleViewVotesPugs
};
