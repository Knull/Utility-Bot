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
 * Handle the `/voteview` command
 * @param {CommandInteraction} interaction 
 */
const handleVoteViewCommand = async (interaction) => {
    try {
        // Defer the slash command to acknowledge it. 
        // This is a PUBLIC reply by default, 
        // so only errors afterward will be ephemeral.
        await interaction.deferReply(); 

        const user = interaction.options.getUser('user');
        const type = interaction.options.getString('type');

        // Basic validation
        if (!user || !type) {
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

        // Validate type
        const validTypes = ['pups', 'pugs', 'pugs_trial'];
        if (!validTypes.includes(type.toLowerCase())) {
            const embed = new EmbedBuilder()
                .setDescription('Invalid type provided. Please choose either `pups`, `pugs`, or `pugs_trial`.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        // Fetch polls for this user+type
        const query = `
            SELECT id, type, active, created_at, upvotes, downvotes
            FROM polls
            WHERE user_id = ?
              AND type = ?
            ORDER BY created_at DESC
        `;
        const params = [user.id, type.toLowerCase()];
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
        const firstPoll = polls[currentPage];

        const embed = createPollEmbed(interaction, user, type, firstPoll, currentPage, totalPages);
        const buttons = createNavigationButtons(interaction, type, currentPage, totalPages);

        // The final success reply is public (or non-ephemeral). 
        // If you want it ephemeral, add ephemeral: true here.
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
 * Create an embed for a specific poll
 * @param {CommandInteraction} interaction 
 * @param {User} user 
 * @param {string} type 
 * @param {Object} poll 
 * @param {number} currentPage 
 * @param {number} totalPages 
 * @returns {EmbedBuilder}
 */
function createPollEmbed(interaction, user, type, poll, currentPage, totalPages) {
    const pollId = currentPage + 1;  // 1-based index

    const pollStatus = poll.active ? 'active' : 'inactive';
    let roleColor = '#e96d6d'; 
    let embedAuthorText = `${type.charAt(0).toUpperCase() + type.slice(1)} Vote`;

    if (type.toLowerCase() === 'pups') {
        const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);
        if (pupsRole) roleColor = pupsRole.color;
    } else if (type.toLowerCase() === 'pugs') {
        const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
        if (pugsRole) roleColor = pugsRole.color;
    } else if (type.toLowerCase() === 'pugs_trial') {
        const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);
        if (pugsTrialRole) roleColor = pugsTrialRole.color;
        embedAuthorText = 'PUGS Trial Vote';
    }

    return new EmbedBuilder()
        .setAuthor({ 
            name: `${user.username} | ${embedAuthorText}`, 
            iconURL: user.displayAvatarURL({ dynamic: true }) 
        })
        .setDescription(
            `- **Poll ID** relative to user: \`${pollId}\`\n` +
            `> This poll is currently __\`${pollStatus}\`__.\u00A0\u00A0\u00A0\u00A0\u00A0`
        )
        .addFields(
            { name: 'Upvotes 👍',   value: `\`\`\`${poll.upvotes}\`\`\``, inline: true },
            { name: 'Downvotes 💔', value: `\`\`\`${poll.downvotes}\`\`\``, inline: true }
        )
        .setFooter({ 
            text: `Poll ${pollId}/${totalPages}`, 
            iconURL: user.displayAvatarURL({ dynamic: true })
        })
        .setColor(roleColor)
        .setTimestamp();
}

/**
 * Create the initial navigation buttons
 * @param {CommandInteraction} interaction 
 * @param {string} type 
 * @param {number} currentPage 
 * @param {number} totalPages 
 * @returns {ActionRowBuilder}
 */
function createNavigationButtons(interaction, type, currentPage, totalPages) {
    const userId = interaction.options.getUser('user').id;

    const prevButton = new ButtonBuilder()
        .setCustomId(`voteview_prev_${userId}_${type}_${currentPage}`)
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0);

    const viewVotesButton = new ButtonBuilder()
        .setCustomId(`voteview_viewvotes_${userId}_${type}_${currentPage}`)
        .setLabel('View Votes')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔍');

    const nextButton = new ButtonBuilder()
        .setCustomId(`voteview_next_${userId}_${type}_${currentPage}`)
        .setEmoji('➡️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === totalPages - 1);

    return new ActionRowBuilder().addComponents(
        prevButton,
        viewVotesButton,
        nextButton
    );
}

/**
 * Handle the Previous Button Interaction
 * @param {ButtonInteraction} interaction
 */
const handlePrevButton = async (interaction) => {
    const customId = interaction.customId; 
    // Format: "voteview_prev_USERID_TYPE_CURRENTPAGE"
    const parts = customId.split('_');
    if (parts.length !== 5) {
        logger.warn(`Invalid customId for previous button: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid interaction.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const userId = parts[2];
    const type = parts[3];
    let currentPage = parseInt(parts[4], 10);

    // Basic validation
    if (isNaN(currentPage) || currentPage <= 0) {
        logger.warn(`Invalid page number in customId: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid page number.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    currentPage -= 1;

    try {
        const query = `
            SELECT id, type, active, created_at, upvotes, downvotes
            FROM polls
            WHERE user_id = ?
              AND type = ?
            ORDER BY created_at DESC
        `;
        const [polls] = await pool.execute(query, [userId, type.toLowerCase()]);

        if (polls.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('No polls found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.update({ embeds: [embed], components: [] });
        }

        const totalPages = polls.length;
        const poll = polls[currentPage];
        
        // Fetch the user so we can display their avatar, etc.
        const user = await interaction.client.users.fetch(userId);

        const embed = createPollEmbed(interaction, user, type, poll, currentPage, totalPages);
        const buttons = createNavigationButtonsFromCustomId(userId, type, currentPage, totalPages);

        // Use update to alter the existing message
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
    // Format: "voteview_next_USERID_TYPE_CURRENTPAGE"
    const parts = customId.split('_');
    if (parts.length !== 5) {
        logger.warn(`Invalid customId for next button: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid interaction.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const userId = parts[2];
    const type = parts[3];
    let currentPage = parseInt(parts[4], 10);

    // Basic validation
    if (isNaN(currentPage)) {
        logger.warn(`Invalid page number in customId: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid page number.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    currentPage += 1;

    try {
        const query = `
            SELECT id, type, active, created_at, upvotes, downvotes
            FROM polls
            WHERE user_id = ?
              AND type = ?
            ORDER BY created_at DESC
        `;
        const [polls] = await pool.execute(query, [userId, type.toLowerCase()]);

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

        const embed = createPollEmbed(interaction, user, type, poll, currentPage, totalPages);
        const buttons = createNavigationButtonsFromCustomId(userId, type, currentPage, totalPages);

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
 * Create navigation buttons for updated page
 * @param {string} userId 
 * @param {string} type 
 * @param {number} currentPage 
 * @param {number} totalPages 
 * @returns {ActionRowBuilder}
 */
function createNavigationButtonsFromCustomId(userId, type, currentPage, totalPages) {
    const prevDisabled = currentPage === 0;
    const nextDisabled = currentPage === totalPages - 1;

    const prevButton = new ButtonBuilder()
        .setCustomId(`voteview_prev_${userId}_${type}_${currentPage}`)
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(prevDisabled);

    const viewVotesButton = new ButtonBuilder()
        .setCustomId(`voteview_viewvotes_${userId}_${type}_${currentPage}`)
        .setLabel('View Votes')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔍');

    const nextButton = new ButtonBuilder()
        .setCustomId(`voteview_next_${userId}_${type}_${currentPage}`)
        .setEmoji('➡️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(nextDisabled);

    return new ActionRowBuilder().addComponents(
        prevButton,
        viewVotesButton,
        nextButton
    );
}

/**
 * Handle View Votes Button Interaction
 * @param {ButtonInteraction} interaction 
 */
const handleViewVotesButton = async (interaction) => {
    try {
        // Defer once, ephemeral for the "View Votes" detail
        await interaction.deferReply({ ephemeral: true });

        const customId = interaction.customId; 
        // e.g. "voteview_viewvotes_1164041015389339698_pugs_trial_1"
        const parts = customId.split('_');

        // Must begin with "voteview_viewvotes"
        if (parts[0] !== 'voteview' || parts[1] !== 'viewvotes') {
            logger.warn(`Invalid customId prefix for view votes button: ${customId}`);
            const embed = new EmbedBuilder()
                .setDescription('Invalid view votes interaction.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // We need at least 5 parts:
        // [ "voteview", "viewvotes", <userID>, <type...>, <page> ]
        if (parts.length < 5) {
            logger.warn(`Invalid customId length for view votes button: ${customId}`);
            const embed = new EmbedBuilder()
                .setDescription('Invalid view votes interaction.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // 3rd part is userId, last part is page
        const userId = parts[2];
        const pageStr = parts[parts.length - 1];
        const currentPage = parseInt(pageStr, 10);

        if (isNaN(currentPage)) {
            logger.warn(`Invalid page number in customId: ${customId}`);
            const embed = new EmbedBuilder()
                .setDescription('Invalid page number.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // Join everything between index=3 and the last part as the type
        const typeParts = parts.slice(3, parts.length - 1);
        const type = typeParts.join('_').toLowerCase();

        // Fetch the polls
        const query = `
            SELECT 
                id,
                user_id,
                type,
                active,
                created_at
            FROM polls
            WHERE user_id = ?
              AND type = ?
            ORDER BY created_at DESC
        `;
        const [polls] = await pool.execute(query, [userId, type]);
        
        if (polls.length === 0 || currentPage >= polls.length) {
            const embed = new EmbedBuilder()
                .setDescription('No polls found for this user and type, or invalid page.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        const poll = polls[currentPage];
        // Route to the correct sub-handler
        if (poll.type.toLowerCase() === 'pups') {
            return handleViewVotesPups(interaction, poll);
        } else if (poll.type.toLowerCase() === 'pugs' || poll.type.toLowerCase() === 'pugs_trial') {
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
 * @param {Object} poll   // includes id, user_id, type, etc.
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

        // Grab pollOwner from the guild
        let pollOwner = null;
        try {
            pollOwner = await interaction.guild.members.fetch(pollDetails.user_id);
            logger.info(`Poll owner fetched: ${pollOwner.user.username}`);
        } catch (err) {
            logger.error(`Poll owner with ID ${pollDetails.user_id} not found.`);
        }

        // All polls for user + type
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

        // Determine color from pups role
        const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);
        const embedColor = pupsRole ? pupsRole.color : 0xFFD700; // fallback

        // Build the embed
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
        // No second defer needed; we already did it in handleViewVotesButton
        const userId = poll.user_id;

        // Confirm the poll belongs to userId, and is pugs or pugs_trial
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

        // Up/down voters
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

        // All pugs or pugs_trial polls for user
        const [allPolls] = await pool.execute(
            'SELECT id FROM polls WHERE user_id = ? AND type IN ("pugs", "pugs_trial") ORDER BY created_at DESC',
            [pollDetails.user_id]
        );
        const totalPolls = allPolls.length;
        const currentPollIndex = allPolls.findIndex(p => p.id === poll.id) + 1;
        if (currentPollIndex === 0) {
            logger.warn(`Poll ID ${poll.id} not found in user poll list.`);
            const embed = new EmbedBuilder()
                .setDescription('Poll not found in your poll list.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], components: [] });
        }

        // Check permission: either pollOwner or an allowed manager role
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

        // Figure out the color
        const roleId = poll.type === 'pugs_trial'
            ? config.pugsTrialRoleId 
            : config.pugsRoleId;
        const role = interaction.guild.roles.cache.get(roleId);
        const embedColor = role ? role.color : 0xFFD700;

        // Determine embed heading
        const embedAuthorText = (poll.type === 'pugs_trial') 
            ? 'PUGS Trial Vote' 
            : 'PUGS Vote';

        // Build embed
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

// Finally, export everything
module.exports = {
    handleVoteViewCommand,
    handlePrevButton,
    handleNextButton,
    handleViewVotesButton,
    handleViewVotesPups,
    handleViewVotesPugs
};
