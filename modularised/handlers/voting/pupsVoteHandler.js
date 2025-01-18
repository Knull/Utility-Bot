// handlers/voting/pupsVoteHandler.js

const { 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder 
} = require('discord.js');
const { pool } = require('../../utilities/database');
const config = require('../../config/config');
const logger = require('../../utilities/logger'); // Ensure you have a logger utility

// List of roles allowed to use PUPS commands
const allowedRoles = [
    config.pupsManagerRoleId,
    config.premiumManagerRoleId,
    config.pugsManagerRoleId
    // Add more role IDs if necessary
];

/**
 * Handle the `/pups vote` command
 * @param {CommandInteraction} interaction 
 */
const handleVote = async (interaction) => {
    const user = interaction.options.getUser('user');
    const member = interaction.member;
    
    // Permission check using the allowedRoles list
    if (!allowedRoles.some(roleId => member.roles.cache.has(roleId))) {
        const embed = new EmbedBuilder()
            .setTitle('Missing Role!')
            .setDescription(`Only these members can use this command:\n${allowedRoles
                .map(roleId => `- <@&${roleId}>`)
                .join('\n')}`)
            .setColor(0x980e00)
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: false });
    }

    // Check for existing active poll
    const [rows] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pups" AND active = 1', [user.id]);
    if (rows.length > 0) {
        const embed = new EmbedBuilder()
            .setDescription('A poll is already active for this user.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Create new poll
    await pool.execute('INSERT INTO polls (user_id, type, upvotes, downvotes, active, created_at) VALUES (?, "pups", 0, 0, 1, NOW())', [user.id]);

    const embed = new EmbedBuilder()
        .setAuthor({ name: `${user.username} | PUPS Vote`, iconURL: user.displayAvatarURL() })
        .setDescription(`> A vote has been created for <@${user.id}> to join <@&${config.pupsRoleId}>.`)
        .addFields(
            { name: 'Upvotes 👍', value: '```0```', inline: true },
            { name: 'Downvotes 👎', value: '```0```', inline: true }
        )
        .setFooter({ text: `Created by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
        .setColor('#e96d6d')
        .setTimestamp();

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`upvote_pups_${user.id}`)
                .setLabel('Upvote')
                .setEmoji('👍')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`downvote_pups_${user.id}`)
                .setLabel('Downvote')
                .setEmoji('👎')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`end_vote_pups_${user.id}`)
                .setLabel('End Vote')
                .setStyle(ButtonStyle.Secondary)
        );

    // Use pupsChannelId from config.js
    const channel = interaction.guild.channels.cache.get(config.pupsChannelId);
    if (!channel) {
        logger.error(`PUPS Channel with ID ${config.pupsChannelId} not found.`);
        const errorEmbed = new EmbedBuilder()
            .setDescription('PUPS voting channel not found.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    await channel.send({ content: `<@&${config.pupsRoleId}>`, embeds: [embed], components: [buttons] });

    const successEmbed = new EmbedBuilder()
        .setDescription('Vote created successfully.')
        .setColor(0xe96d6d)
        .setTimestamp();

    return interaction.reply({ embeds: [successEmbed], ephemeral: true });
};

/**
 * Common function to handle vote buttons, including changing votes
 * @param {ButtonInteraction} interaction 
 * @param {string} voteType - 'upvote' or 'downvote'
 */
const handleVoteButton = async (interaction, voteType) => {
    const customId = interaction.customId;
    const parts = customId.split('_');

    if (parts.length < 3) {
        logger.warn(`Invalid customId: ${customId}`);
        return interaction.reply({ content: 'Invalid interaction.', ephemeral: true });
    }

    const action = parts[0]; // 'upvote' or 'downvote'
    const type = parts[1]; // 'pups'
    const targetUserId = parts.slice(2).join('_'); // In case user IDs have underscores

    if (type !== 'pups') {
        logger.warn(`Ignoring non-pups type: ${type}`);
        return interaction.reply({ content: 'This interaction is not valid for PUPS polls.', ephemeral: true });
    }

    // Fetch active poll
    const [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pups" AND active = 1', [targetUserId]);
    if (polls.length === 0) {
        logger.warn('No active poll found for the user.');
        return interaction.reply({ content: 'No active poll found for this user.', ephemeral: true });
    }

    const poll = polls[0];

    // Permission check using the allowedRoles list
    if (!allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
        const embed = new EmbedBuilder()
            .setDescription(`You do not have permission to vote. Required roles:\n${allowedRoles.map(roleId => `<@&${roleId}>`).join('\n')}`)
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: false });
    }

    // Prevent self-voting
    if (interaction.user.id === targetUserId) {
        const embed = new EmbedBuilder()
            .setDescription('You cannot vote on your own poll.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Check if the user has already voted
    const [existingVote] = await pool.execute('SELECT * FROM votes WHERE user_id = ? AND poll_id = ?', [interaction.user.id, poll.id]);

    if (existingVote.length > 0) {
        const previousVote = existingVote[0].vote;
        if (previousVote === voteType) {
            const embed = new EmbedBuilder()
                .setDescription(`You have already ${voteType}d this poll.`)
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
            // User is changing their vote
            try {
                // Begin transaction
                const connection = await pool.getConnection();
                try {
                    await connection.beginTransaction();

                    if (voteType === 'upvote') {
                        await connection.execute('UPDATE polls SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id = ?', [poll.id]);
                        await connection.execute('UPDATE votes SET vote = "upvote" WHERE user_id = ? AND poll_id = ?', [interaction.user.id, poll.id]);
                    } else if (voteType === 'downvote') {
                        await connection.execute('UPDATE polls SET downvotes = downvotes + 1, upvotes = upvotes - 1 WHERE id = ?', [poll.id]);
                        await connection.execute('UPDATE votes SET vote = "downvote" WHERE user_id = ? AND poll_id = ?', [interaction.user.id, poll.id]);
                    }

                    await connection.commit();
                    logger.info(`User ${interaction.user.id} changed their vote to ${voteType} on poll for user ${targetUserId}`);
                } catch (error) {
                    await connection.rollback();
                    throw error;
                } finally {
                    connection.release();
                }

                // Fetch updated poll
                const [updatedPolls] = await pool.execute('SELECT * FROM polls WHERE id = ?', [poll.id]);
                const updatedPoll = updatedPolls[0];

                // Update the embed in the voting channel
                const channel = interaction.guild.channels.cache.get(config.pupsChannelId);
                if (!channel) {
                    logger.error(`PUPS Channel with ID ${config.pupsChannelId} not found.`);
                    const errorEmbed = new EmbedBuilder()
                        .setDescription('PUPS voting channel not found.')
                        .setColor(0x980e00)
                        .setTimestamp();
                    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }

                // Fetch the original message to update
                const fetchedMessages = await channel.messages.fetch({ limit: 100 });
                const targetMember = interaction.guild.members.cache.get(targetUserId);
                if (!targetMember) {
                    logger.error(`Target member with ID ${targetUserId} not found.`);
                    const errorEmbed = new EmbedBuilder()
                        .setDescription('Target member not found.')
                        .setColor(0x980e00)
                        .setTimestamp();
                    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }

                const message = fetchedMessages.find(msg => 
                    msg.embeds.length > 0 && 
                    msg.embeds[0].author && 
                    msg.embeds[0].author.name === `${targetMember.user.username} | PUPS Vote`
                );

                if (!message) {
                    logger.error('Original voting message not found.');
                    const errorEmbed = new EmbedBuilder()
                        .setDescription('Original voting message not found.')
                        .setColor(0x980e00)
                        .setTimestamp();
                    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }

                const embed = EmbedBuilder.from(message.embeds[0])
                    .setDescription(`A vote has been created for <@${targetUserId}> to join <@&${config.pupsRoleId}>.`)
                    .spliceFields(0, 2, 
                        { name: 'Upvotes 👍', value: `\`\`\`${updatedPoll.upvotes}\`\`\``, inline: true },
                        { name: 'Downvotes 👎', value: `\`\`\`${updatedPoll.downvotes}\`\`\``, inline: true }
                    )
                    .setTimestamp();

                await message.edit({ embeds: [embed] });

                const replyEmbed = new EmbedBuilder()
                    .setDescription(`Your vote has been changed to **${voteType}**.`)
                    .setColor(0xe96d6d)
                    .setTimestamp();

                return interaction.reply({ embeds: [replyEmbed], ephemeral: true });
            } catch (error) {
                logger.error('Error changing vote:', error);
                const errorEmbed = new EmbedBuilder()
                    .setDescription('An error occurred while changing your vote.')
                    .setColor(0x980e00)
                    .setTimestamp();
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    } else {
        // User has not voted yet, proceed to cast the vote
        try {
            // Begin transaction
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                if (voteType === 'upvote') {
                    await connection.execute('UPDATE polls SET upvotes = upvotes + 1 WHERE id = ?', [poll.id]);
                    await connection.execute('INSERT INTO votes (user_id, poll_id, vote) VALUES (?, ?, "upvote")', [interaction.user.id, poll.id]);
                } else if (voteType === 'downvote') {
                    await connection.execute('UPDATE polls SET downvotes = downvotes + 1 WHERE id = ?', [poll.id]);
                    await connection.execute('INSERT INTO votes (user_id, poll_id, vote) VALUES (?, ?, "downvote")', [interaction.user.id, poll.id]);
                }

                await connection.commit();
                logger.info(`User ${interaction.user.id} cast a ${voteType} on poll for user ${targetUserId}`);
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }

            // Fetch updated poll
            const [updatedPolls] = await pool.execute('SELECT * FROM polls WHERE id = ?', [poll.id]);
            const updatedPoll = updatedPolls[0];

            // Update the embed in the voting channel
            const channel = interaction.guild.channels.cache.get(config.pupsChannelId);
            if (!channel) {
                logger.error(`PUPS Channel with ID ${config.pupsChannelId} not found.`);
                const errorEmbed = new EmbedBuilder()
                    .setDescription('PUPS voting channel not found.')
                    .setColor(0x980e00)
                    .setTimestamp();
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Fetch the original message to update
            const fetchedMessages = await channel.messages.fetch({ limit: 100 });
            const targetMember = interaction.guild.members.cache.get(targetUserId);
            if (!targetMember) {
                logger.error(`Target member with ID ${targetUserId} not found.`);
                const errorEmbed = new EmbedBuilder()
                    .setDescription('Target member not found.')
                    .setColor(0x980e00)
                    .setTimestamp();
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            const message = fetchedMessages.find(msg => 
                msg.embeds.length > 0 && 
                msg.embeds[0].author && 
                msg.embeds[0].author.name === `${targetMember.user.username} | PUPS Vote`
            );

            if (!message) {
                logger.error('Original voting message not found.');
                const errorEmbed = new EmbedBuilder()
                    .setDescription('Original voting message not found.')
                    .setColor(0x980e00)
                    .setTimestamp();
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            const embed = EmbedBuilder.from(message.embeds[0])
                .setDescription(`A vote has been created for <@${targetUserId}> to join <@&${config.pupsRoleId}>.`)
                .spliceFields(0, 2, 
                    { name: 'Upvotes 👍', value: `\`\`\`${updatedPoll.upvotes}\`\`\``, inline: true },
                    { name: 'Downvotes 👎', value: `\`\`\`${updatedPoll.downvotes}\`\`\``, inline: true }
                )
                .setTimestamp();

            await message.edit({ embeds: [embed] });

            const replyEmbed = new EmbedBuilder()
                .setDescription(`You have cast a **${voteType}**.`)
                .setColor(0xe96d6d)
                .setTimestamp();

            return interaction.reply({ embeds: [replyEmbed], ephemeral: true });
        } catch (error) {
            logger.error('Error casting vote:', error);
            const errorEmbed = new EmbedBuilder()
                .setDescription('An error occurred while casting your vote.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
};

/**
 * Handle the Upvote button
 * @param {ButtonInteraction} interaction 
 */
const handleUpvote = async (interaction) => {
    await handleVoteButton(interaction, 'upvote');
};

/**
 * Handle the Downvote button
 * @param {ButtonInteraction} interaction 
 */
const handleDownvote = async (interaction) => {
    await handleVoteButton(interaction, 'downvote');
};

/**
 * Handle the End Vote button
 * @param {ButtonInteraction} interaction 
 */
const handleEndVote = async (interaction) => {
    const customId = interaction.customId;
    const parts = customId.split('_');

    if (parts.length < 4) {
        logger.warn(`Invalid customId: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid interaction.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const action = `${parts[0]}_${parts[1]}`; // 'end_vote'
    const type = parts[2]; // 'pups'
    const targetUserId = parts.slice(3).join('_'); // Handle any underscores in user IDs

    if (type !== 'pups') {
        logger.warn(`Ignoring non-pups type: ${type}`);
        const embed = new EmbedBuilder()
            .setDescription('This interaction is not valid for PUPS polls.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Fetch active poll
    const [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pups" AND active = 1', [targetUserId]);
    if (polls.length === 0) {
        logger.warn('No active poll found for the user.');
        const embed = new EmbedBuilder()
            .setDescription('No active poll found for this user.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const poll = polls[0];
    const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);

    // Permission check using the allowedRoles list
    if (!allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId))) {
        const embed = new EmbedBuilder()
            .setDescription(`Only people with these roles can use this button:\n${allowedRoles.map(roleId => `<@&${roleId}>`).join('\n')}`)
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: false });
    }

    // Deactivate the poll
    try {
        await pool.execute('UPDATE polls SET active = 0 WHERE id = ?', [poll.id]);
    } catch (error) {
        logger.error('Error deactivating poll:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while ending the vote.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const upvotes = poll.upvotes;
    const downvotes = poll.downvotes;
    const result = upvotes > downvotes ? 'won' : 'lost';
    const resultColor = upvotes > downvotes ? '#00FF00' : '#FF0000';

    // Disable all buttons in the original message
    const disabledButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`upvote_pups_${targetUserId}`)
            .setLabel('Upvote')
            .setEmoji('👍')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`downvote_pups_${targetUserId}`)
            .setLabel('Downvote')
            .setEmoji('👎')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`end_vote_pups_${targetUserId}`)
            .setLabel('End Vote')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
    );

    // Fetch the original message to update
    const channel = interaction.guild.channels.cache.get(config.pupsChannelId);
    if (!channel) {
        logger.error(`PUPS Channel with ID ${config.pupsChannelId} not found.`);
        const embed = new EmbedBuilder()
            .setDescription('PUPS voting channel not found.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const fetchedMessages = await channel.messages.fetch({ limit: 100 });
    const targetMember = interaction.guild.members.cache.get(targetUserId);
    if (!targetMember) {
        logger.error(`Target member with ID ${targetUserId} not found.`);
        const embed = new EmbedBuilder()
            .setDescription('Target member not found.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const message = fetchedMessages.find(msg => 
        msg.embeds.length > 0 && 
        msg.embeds[0].author && 
        msg.embeds[0].author.name === `${targetMember.user.username} | PUPS Vote`
    );

    if (!message) {
        logger.error('Original voting message not found.');
        const embed = new EmbedBuilder()
            .setDescription('Original voting message not found.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Update the embed with the final vote counts
    const embed = EmbedBuilder.from(message.embeds[0])
        .setDescription(`A vote has been created for <@${targetUserId}> to join <@&${config.pupsRoleId}>.`)
        .spliceFields(0, 2, 
            { name: 'Upvotes 👍', value: `\`\`\`${upvotes}\`\`\``, inline: true },
            { name: 'Downvotes 👎', value: `\`\`\`${downvotes}\`\`\``, inline: true }
        )
        .setTimestamp();

    try {
        await message.edit({ embeds: [embed], components: [disabledButtons] });

        // Create a result embed
        const resultEmbed = new EmbedBuilder()
            .setAuthor({ name: `${targetMember.user.username} | PUPS Vote Results`, iconURL: targetMember.user.displayAvatarURL() })
            .setDescription(`**Upvotes 👍:** \`\`\`${upvotes}\`\`\`\n**Downvotes 💔:** \`\`\`${downvotes}\`\`\`\n<@${targetUserId}> has **${result}** the vote!`)
            .setColor(resultColor)
            .setFooter({ text: `Created by ${message.embeds[0].footer.text.replace('Created by ', '')}`, iconURL: message.embeds[0].footer.iconURL })
            .setTimestamp();

        // Add a button to view votes
        const viewVotesButton = new ButtonBuilder()
            .setCustomId(`view_votes_pups_${poll.id}`)
            .setLabel('View Votes')
            .setStyle(ButtonStyle.Primary);

        const buttons = new ActionRowBuilder().addComponents(viewVotesButton);

        await interaction.reply({ embeds: [resultEmbed], components: [buttons], ephemeral: true });

        // Create an announcement embed
        const pupsRoleColor = pupsRole.color || 0xe96d6d; // Default color if not set

        const announcementEmbed = new EmbedBuilder()
            .setAuthor({ name: targetMember.user.username, iconURL: targetMember.user.displayAvatarURL() })
            .setTitle(poll.upvotes > poll.downvotes ? 'PUPS Addition' : 'PUPS Removal')
            .setDescription(`<@${targetUserId}> has been ${poll.upvotes > poll.downvotes ? 'added to' : 'removed from'} <@&${config.pupsRoleId}>.`)
            .addFields(
                { name: poll.upvotes > poll.downvotes ? 'Added by' : 'Removed by', value: `<@${interaction.user.id}> who ${poll.upvotes > poll.downvotes ? 'added' : 'removed'} them.`, inline: false }
            )
            .setColor(pupsRoleColor)
            .setTimestamp();

        await channel.send({ embeds: [announcementEmbed] }).then(sentMessage => {
            if (poll.upvotes > poll.downvotes) {
                sentMessage.react('🔥'); // Fire emoji for addition
            } else {
                sentMessage.react('💔'); // Heartbreak emoji for removal
            }
        });

        const followUpEmbed = new EmbedBuilder()
            .setDescription('Vote ended successfully.')
            .setColor(0xe96d6d)
            .setTimestamp();

        await interaction.followUp({ embeds: [followUpEmbed], ephemeral: true });
    } catch (error) {
        logger.error(`Error handling end_vote interaction: ${error}`);
        const embed = new EmbedBuilder()
            .setDescription('Error handling end_vote interaction.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

/**
 * Handle the View Votes button
 * @param {ButtonInteraction} interaction 
 */
const handleViewVotes = async (interaction) => {
    const customId = interaction.customId;
    const parts = customId.split('_');

    if (parts.length < 4) {
        logger.warn(`Invalid customId for view votes: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid interaction.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const pollType = parts[2]; // 'pups'
    const pollId = parts[3];

    if (pollType !== 'pups') {
        logger.warn(`Ignoring non-pups poll type: ${pollType}`);
        const embed = new EmbedBuilder()
            .setDescription('This interaction is not valid for PUPS polls.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
        // Fetch poll details
        const [polls] = await pool.execute('SELECT * FROM polls WHERE id = ? AND type = "pups"', [pollId]);
        if (polls.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('Poll not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const poll = polls[0];

        // Fetch upvoters
        const [upvoters] = await pool.execute('SELECT user_id FROM votes WHERE poll_id = ? AND vote = "upvote"', [pollId]);
        // Fetch downvoters
        const [downvoters] = await pool.execute('SELECT user_id FROM votes WHERE poll_id = ? AND vote = "downvote"', [pollId]);

        // Map user IDs to mentions
        const upvoteMentions = upvoters.map(v => `<@${v.user_id}>`).join('\n') || 'No upvotes yet.';
        const downvoteMentions = downvoters.map(v => `<@${v.user_id}>`).join('\n') || 'No downvotes yet.';

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${interaction.guild.members.cache.get(poll.user_id)?.user.username || 'User'} | PUPS Vote Results`, iconURL: interaction.guild.members.cache.get(poll.user_id)?.user.displayAvatarURL() || interaction.guild.iconURL() })
            .addFields(
                { name: 'Upvotes 👍', value: upvoteMentions, inline: true },
                { name: 'Downvotes 💔', value: downvoteMentions, inline: true }
            )
            .setColor('#FFD700') // Gold color for results
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        logger.error('Error fetching vote details:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while fetching the votes.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

/**
 * Handle the `/pups create` command for managers to create their own PUPS votes
 * @param {CommandInteraction} interaction 
 */
const handleCreate = async (interaction) => {
    const user = interaction.user;
    const member = interaction.member;

    // Permission check using the allowedRoles list
    if (!allowedRoles.some(roleId => member.roles.cache.has(roleId))) {
        const embed = new EmbedBuilder()
            .setTitle('Missing Role!')
            .setDescription(`Only these members can use this command:\n${allowedRoles
                .map(roleId => `- <@&${roleId}>`)
                .join('\n')}`)
            .setColor(0x980e00)
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: false });
    }

    try {
        // Check if the user already has an active poll
        const [activePolls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pups" AND active = 1', [user.id]);
        if (activePolls.length > 0) {
            const embed = new EmbedBuilder()
                .setDescription('You already have an active PUPS poll.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Check if the user is already PUGS or PREMIUM
        const memberData = await interaction.guild.members.fetch(user.id);
        if (!memberData) {
            const embed = new EmbedBuilder()
                .setDescription('Member data not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const isPugs = memberData.roles.cache.has(config.pugsRoleId);
        const isPremium = memberData.roles.cache.has(config.premiumRoleId);

        if (isPugs || isPremium) {
            const embed = new EmbedBuilder()
                .setDescription('You cannot create a PUPS poll while holding PUGS or PREMIUM roles.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Create new poll
        await pool.execute('INSERT INTO polls (user_id, type, upvotes, downvotes, active, created_at) VALUES (?, "pups", 0, 0, 1, NOW())', [user.id]);

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${user.username} | PUPS Vote`, iconURL: user.displayAvatarURL() })
            .setDescription(`You have initiated a vote to join <@&${config.pupsRoleId}>.`)
            .addFields(
                { name: 'Upvotes 👍', value: '```0```', inline: true },
                { name: 'Downvotes 👎', value: '```0```', inline: true }
            )
            .setFooter({ text: `Created by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setColor('#e96d6d')
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`upvote_pups_${user.id}`)
                    .setLabel('Upvote')
                    .setEmoji('👍')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`downvote_pups_${user.id}`)
                    .setLabel('Downvote')
                    .setEmoji('👎')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`end_vote_pups_${user.id}`)
                    .setLabel('End Vote')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Use pupsChannelId from config.js
        const channel = interaction.guild.channels.cache.get(config.pupsChannelId);
        if (!channel) {
            logger.error(`PUPS Channel with ID ${config.pupsChannelId} not found.`);
            const errorEmbed = new EmbedBuilder()
                .setDescription('PUPS voting channel not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        await channel.send({ content: `<@&${config.pupsRoleId}>`, embeds: [embed], components: [buttons] });

        const successEmbed = new EmbedBuilder()
            .setDescription('Your PUPS vote has been created successfully.')
            .setColor(0xe96d6d)
            .setTimestamp();

        return interaction.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (error) {
        logger.error('Error creating PUPS poll:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while creating your PUPS poll.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

/**
 * Handle the `/pups list` command
 * @param {CommandInteraction} interaction 
 */
const handleList = async (interaction) => {
    const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);

    if (!pupsRole) {
        logger.error(`PUPS Role with ID ${config.pupsRoleId} not found.`);
        const embed = new EmbedBuilder()
            .setDescription('PUPS role not found.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const membersWithRole = await interaction.guild.members.fetch();
    const membersArray = Array.from(membersWithRole.values()).filter(member => member.roles.cache.has(pupsRole.id));
    const pageSize = 10;
    const totalPages = Math.ceil(membersArray.length / pageSize);

    if (totalPages === 0) {
        const noMembersEmbed = new EmbedBuilder()
            .setDescription('```ini\nNo members with PUPS role found.\n```')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [noMembersEmbed], ephemeral: true });
    }

    const currentPage = 0; // Start with the first page
    const paginatedMembers = membersArray.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

    const memberList = paginatedMembers.map((member, index) => `\`\`${index + 1 + currentPage * pageSize}.\`\` <@${member.id}>`).join('\n');
    const userPosition = membersArray.findIndex(member => member.id === interaction.user.id) + 1;

    const pupsRoleColor = pupsRole.color || 0xe96d6d; // Fallback color if role has no color

    const listEmbed = new EmbedBuilder()
        .setAuthor({ name: 'PUPS List', iconURL: interaction.guild.iconURL() })
        .setDescription(`Mode: **PUPS** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
        .setFooter({ text: `${userPosition}. [${interaction.user.username}]`, iconURL: interaction.user.displayAvatarURL() })
        .setColor(pupsRoleColor)
        .setTimestamp();

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`prev_list_pups_${interaction.user.id}_${currentPage}`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`next_list_pups_${interaction.user.id}_${currentPage}`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages - 1)
        );

    await interaction.reply({ embeds: [listEmbed], components: [buttons], ephemeral: false });
};

/**
 * Handle pagination for the PUPS list
 * @param {ButtonInteraction} interaction 
 */
const handlePagination = async (interaction) => {
    const customId = interaction.customId; // e.g., 'next_list_pups_1155078877803192420_0'
    const parts = customId.split('_');

    if (parts.length < 5) {
        logger.warn(`Invalid customId format for pagination: ${customId}`);
        const embed = new EmbedBuilder()
            .setDescription('Invalid pagination interaction.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const action = parts[0]; // 'next' or 'prev'
    const type = parts[1]; // 'list'
    const role = parts[2]; // 'pups'
    const userId = parts[3]; // '1155078877803192420'
    let currentPage = parseInt(parts[4], 10); // 0

    if (interaction.user.id !== userId) {
        const embed = new EmbedBuilder()
            .setDescription(`> Only <@${userId}> can interact with these buttons.`)
            .setColor('#D72F2F')
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Fetch the PUPS role
    const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);
    if (!pupsRole) {
        logger.error(`PUPS Role with ID ${config.pupsRoleId} not found.`);
        const embed = new EmbedBuilder()
            .setDescription('PUPS role not found.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
        const membersWithRole = await interaction.guild.members.fetch();
        const membersArray = Array.from(membersWithRole.values()).filter(member => member.roles.cache.has(pupsRole.id));
        const userPosition = membersArray.findIndex(member => member.id === interaction.user.id) + 1;

        if (membersArray.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('No members have the PUPS role.')
                .setColor(0xFFD700)
                .setTimestamp();
            return interaction.update({ embeds: [embed], components: [] });
        }

        const pageSize = 10;
        const totalPages = Math.ceil(membersArray.length / pageSize);

        if (currentPage < 0 || currentPage >= totalPages) {
            const embed = new EmbedBuilder()
                .setDescription('Invalid page number.')
                .setColor(0xFFD700)
                .setTimestamp();
            return interaction.update({ embeds: [embed], components: [] });
        }

        if (action === 'next') {
            currentPage += 1;
        } else if (action === 'prev') {
            currentPage -= 1;
        } else {
            logger.warn(`Unknown pagination action: ${action}`);
            const embed = new EmbedBuilder()
                .setDescription('Unknown pagination action.')
                .setColor(0xFFD700)
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Ensure currentPage is within bounds after increment/decrement
        if (currentPage < 0) currentPage = 0;
        if (currentPage >= totalPages) currentPage = totalPages - 1;

        const paginatedMembers = membersArray.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
        const memberList = paginatedMembers.map((member, index) => `\`\`${index + 1 + currentPage * pageSize}.\`\` <@${member.id}>`).join('\n');

        const pupsRoleColor = pupsRole.color || 0xe96d6d; // Fallback color if role has no color

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'PUPS List', iconURL: interaction.guild.iconURL() })
            .setDescription(`Mode: **PUPS** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
            .setFooter({ text: `${userPosition}. [${interaction.user.username}]`, iconURL: interaction.user.displayAvatarURL() })
            .setColor(pupsRoleColor)
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev_list_pups_${userId}_${currentPage}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`next_list_pups_${userId}_${currentPage}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1)
            );

        await interaction.update({ embeds: [embed], components: [buttons] });
        logger.info(`PUPS list pagination: user ${userId} navigated to page ${currentPage + 1}/${totalPages}`);
    } catch (error) {
        logger.error('Error handling pagination:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while handling pagination.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

/**
 * Handle the `/pups add` command
 * @param {CommandInteraction} interaction 
 */
const handleAdd = async (interaction) => {
    const user = interaction.options.getUser('user');

    if (!user) {
        const embed = new EmbedBuilder()
            .setDescription('Please provide a user to add the PUPS role to.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const executor = interaction.member;

    // Permission check using the allowedRoles list
    if (!allowedRoles.some(roleId => executor.roles.cache.has(roleId))) {
        const embed = new EmbedBuilder()
            .setTitle('Missing Role!')
            .setDescription(`Only these members can use this command:\n${allowedRoles.map(roleId => `<@&${roleId}>`).join('\n')}`)
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: false });
    }

    try {
        const member = await interaction.guild.members.fetch(user.id);
        const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);

        if (!pupsRole) {
            logger.error(`PUPS Role with ID ${config.pupsRoleId} not found.`);
            const embed = new EmbedBuilder()
                .setDescription('PUPS role not found.')
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (member.roles.cache.has(pupsRole.id)) {
            const embed = new EmbedBuilder()
                .setDescription(`> <@${user.id}> is already <@&${config.pupsRoleId}>`)
                .setColor(0xFFD700);
            return interaction.reply({ embeds: [embed], ephemeral: false });
        }

        await member.roles.add(pupsRole);

        // Reply with confirmation embed
        const addedEmbed = new EmbedBuilder()
            .setDescription(`> Added <@${user.id}> to <@&${config.pupsRoleId}>.`)
            .setColor(pupsRole.color || 0x00FF00); // Default to green if role has no color
        await interaction.reply({ embeds: [addedEmbed], ephemeral: false });

        // Create announcement embed
        const announcementEmbed = new EmbedBuilder()
            .setAuthor({ 
                name: member.user.username, 
                iconURL: member.user.displayAvatarURL() 
            })
            .setTitle('PUPS Addition')
            .setDescription(
                `> <@${user.id}> has been added to <@&${config.pupsRoleId}>.\n- **Added by:** <@${interaction.user.id}>`
            )
            .setColor(pupsRole.color || 0x00FF00) // Same as role color
            .setTimestamp();

        const pupsChannel = interaction.guild.channels.cache.get(config.pupsChannelId);
        if (pupsChannel) {
            const sentMessage = await pupsChannel.send({ embeds: [announcementEmbed] });
            await sentMessage.react('🔥'); // Fire emoji for addition
        } else {
            logger.error(`PUPS Channel with ID ${config.pupsChannelId} not found.`);
        }
    } catch (error) {
        logger.error('Error adding PUPS role:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while adding the PUPS role.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

/**
 * Handle the `/pups remove` command
 * @param {CommandInteraction} interaction 
 */
const handleRemove = async (interaction) => {
    const user = interaction.options.getUser('user');

    if (!user) {
        const embed = new EmbedBuilder()
            .setDescription('You need to provide a user to remove the PUPS from.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const executor = interaction.member;

    // Permission check using the allowedRoles list
    if (!allowedRoles.some(roleId => executor.roles.cache.has(roleId))) {
        const embed = new EmbedBuilder()
            .setTitle('Missing Role!')
            .setDescription(`Only these members can use this command:\n${allowedRoles
                .map(roleId => `- <@&${roleId}>`)
                .join('\n')}`)
            .setColor(0x980e00)
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: false });
    }

    try {
        const member = await interaction.guild.members.fetch(user.id);
        const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);

        if (!pupsRole) {
            logger.error(`PUPS Role with ID ${config.pupsRoleId} not found.`);
            const embed = new EmbedBuilder()
                .setDescription(`PUPS role not found.\n> Current PUPS role config: ${config.pupsRoleId}`)
                .setColor(0x980e00)
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (!member.roles.cache.has(pupsRole.id)) {
            const embed = new EmbedBuilder()
                .setDescription(`> <@${user.tag}> is not <@&${config.pupsRoleId}>.`)
                .setColor(0xFFD700);
            return interaction.reply({ embeds: [embed], ephemeral: false });
        }

        await member.roles.remove(pupsRole);

        // Reply with confirmation embed
        const removedEmbed = new EmbedBuilder()
            .setDescription(`> Removed <@${user.id}> from <@&${config.pupsRoleId}>.`)
            .setColor(pupsRole.color || 0xFF0000); // Default to red if role has no color
        await interaction.reply({ embeds: [removedEmbed], ephemeral: false });

        // Create announcement embed
        const announcementEmbed = new EmbedBuilder()
            .setAuthor({ 
                name: member.user.username, 
                iconURL: member.user.displayAvatarURL() 
            })
            .setTitle('PUPS Removal')
            .setDescription(
                `> <@${user.id}> has been removed from <@&${config.pupsRoleId}>.\n- **Removed by:** <@${interaction.user.id}>`
            )
            .setColor(pupsRole.color || 0xFF0000) // Same as role color
            .setTimestamp();

        const pupsChannel = interaction.guild.channels.cache.get(config.pupsChannelId);
        if (pupsChannel) {
            const sentMessage = await pupsChannel.send({ embeds: [announcementEmbed] });
            await sentMessage.react('💔'); // Heartbreak emoji for removal
        } else {
            logger.error(`PUPS Channel with ID ${config.pupsChannelId} not found.`);
        }
    } catch (error) {
        logger.error('Error removing PUPS role:', error);
        const embed = new EmbedBuilder()
            .setDescription('An error occurred while removing the PUPS role.')
            .setColor(0x980e00)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

/**
 * Handle the `/pups myvote` command
 * @param {CommandInteraction} interaction 
 */
const handleMyVote = async (interaction) => {
    const userId = interaction.user.id;
    let [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pups" ORDER BY created_at DESC', [userId]);

    if (polls.length === 0) {
        const noPollsEmbed = new EmbedBuilder()
            .setDescription('```ini\nYou do not have any polls```\n')
            .setColor('#D72F2F')
            .setTimestamp();
        return interaction.reply({ embeds: [noPollsEmbed], ephemeral: true });
    }

    const currentPage = 0; // Start with the first poll
    const poll = polls[currentPage];
    const status = poll.active ? 'active' : 'inactive';
    const user = interaction.user;

    const pollEmbed = new EmbedBuilder()
        .setAuthor({ name: `${user.username} | PUPS Vote`, iconURL: user.displayAvatarURL() })
        .setDescription(`> A vote has been created for <@${poll.user_id}> to join <@&${config.pupsRoleId}>.`)
        .addFields(
            { name: 'Upvotes 👍', value: `\`\`\`${poll.upvotes}\`\`\``, inline: true },
            { name: 'Downvotes 👎', value: `\`\`\`${poll.downvotes}\`\`\``, inline: true }
        )
        .setFooter({ text: `Poll ${currentPage + 1}/${polls.length}`, iconURL: user.displayAvatarURL() })
        .setColor('#e96d6d')
        .setTimestamp();

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`prev_pups_${userId}_${currentPage}`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`next_pups_${userId}_${currentPage}`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === polls.length - 1),
            new ButtonBuilder()
                .setCustomId(`view_votes_pups_${poll.id}`)
                .setLabel('View Votes')
                .setStyle(ButtonStyle.Primary)
        );

    await interaction.reply({ embeds: [pollEmbed], components: [buttons], ephemeral: false });
};

/**
 * Close a poll by setting its status to 'closed'
 * @param {number} pollId 
 */
const closePreviousPoll = async (pollId) => {
    await pool.execute('UPDATE polls SET status = "closed" WHERE id = ?', [pollId]);
};

// Export all handlers and necessary properties
module.exports = {
    allowedRoles,
    handleVote,
    handleUpvote,
    handleDownvote,
    handleVoteButton,
    handleEndVote,
    handleViewVotes,
    handleCreate,
    handleList,
    handlePagination,
    handleAdd,
    handleRemove,
    handleMyVote,
    closePreviousPoll
};
