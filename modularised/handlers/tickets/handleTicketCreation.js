// handlers/tickets/handleTicketCreation.js
const { EmbedBuilder } = require('discord.js');
const { getPermissionOverwrites, getCategoryId, sendEmbed, sendPlainText } = require('../../utilities/ticketUtils');
const { pool } = require('../../database');
const config = require('../../config/config');

async function handleTicketCreation(interaction, client, ticketType) {
    try {
        // Defer the interaction reply
        await interaction.deferReply({ ephemeral: true });
        console.log('Interaction deferred successfully.');

        const { guild, user } = interaction;

        // Validate guild and user
        if (!guild) {
            throw new Error('Guild is undefined.');
        }

        if (!user) {
            throw new Error('User is undefined.');
        }

        // Fetch the current ticket counter from the database
        const [settingsRows] = await pool.execute('SELECT * FROM ticket_settings WHERE id = 1');
        let ticketCounter = settingsRows[0].ticket_counter;
        const prefix = '┃';

        // Process the username to remove special characters or spaces
        let username = user.username.split(/[\s\W_]+/)[0];
        username = username || user.username;

        const ticketChannelName = `${ticketCounter}${prefix}${username}`;

        const permissionOverwrites = getPermissionOverwrites(guild, user.id, ticketType);
        const parentCategoryId = getCategoryId(ticketType);

        // Validate parent category ID
        if (!parentCategoryId) {
            throw new Error(`Parent category ID for ticket type "${ticketType}" is undefined.`);
        }

        // Create the ticket channel
        const ticketChannel = await guild.channels.create({
            name: ticketChannelName,
            type: ChannelType.GuildText,
            parent: parentCategoryId,
            permissionOverwrites,
            topic: `[${ticketType}] Ticket for ${user.username}`,
        });

        if (!ticketChannel) {
            throw new Error('Failed to create the ticket channel.');
        }

        console.log(`Ticket channel created: ${ticketChannel.name} (ID: ${ticketChannel.id})`);

        // Send welcome message as plain text
        await sendPlainText(ticketChannel, `Hey <@${user.id}> 👋!\nPlease wait patiently!`);
        console.log('Welcome message sent to the ticket channel.');

        // Prepare embed and buttons based on ticket type
        let ticketInfoEmbed;
        let row;

        if (ticketType === 'Staff Report') {
            ticketInfoEmbed = new EmbedBuilder()
                .setColor(0x05D9FF)
                .setAuthor({ name: `${ticketType} Ticket`, iconURL: guild.iconURL({ dynamic: true }) })
                .setTitle('Ticket Details')
                .setDescription(
                    `**Issued by:** <@${user.id}>\n` +
                    `**Reported User:** ${interaction.fields?.getTextInputValue('reported_user') || 'Unknown'}\n` +
                    `**Reason:**\n> ${interaction.fields?.getTextInputValue('reason')?.replace(/\n/g, '\n> ') || 'No reason provided.'}\n` +
                    '```\nPlease wait patiently for staff to evaluate the evidence. In the meantime, if you have anything else to add, do so now. Refrain from pinging staff, please.\n```'
                )
                .setFooter({ text: 'Pika Ranked Bedwars Tickets!' })
                .setTimestamp();

            row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒'),
                new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('Claim')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('<a:claim:1298228030405214269>'),
                new ButtonBuilder()
                    .setCustomId(`evidence_${ticketCounter}`)
                    .setLabel('Evidence')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📁'),
                new ButtonBuilder()
                    .setCustomId(`report_details_${ticketCounter}`)
                    .setLabel('Report Details')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('<a:attention:1298284499829784596>')
            );

            // Send the embed and capture the sent message
            console.log('Preparing to send Ticket Details embed.');
            const ticketMessage = await sendEmbed(ticketChannel, ticketInfoEmbed, row);

            if (!ticketMessage) {
                throw new Error('Failed to send the ticket embed message.');
            }

            console.log(`Ticket embed sent with Message ID: ${ticketMessage.id}`);

            // Save the ticket data in the database
            await pool.execute(
                'INSERT INTO tickets (user_id, channel_id, ticket_number, ticket_type, reported_user, reason, proof_urls, ticket_message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    user.id,
                    ticketChannel.id,
                    ticketCounter,
                    ticketType,
                    interaction.fields?.getTextInputValue('reported_user') || 'Unknown',
                    interaction.fields?.getTextInputValue('reason') || 'No reason provided.',
                    JSON.stringify(interaction.fields?.getTextInputValue('proof')?.split(/\s+/) || []),
                    ticketMessage.id,
                ]
            );

        } else if (ticketType === 'Partnership') {
            ticketInfoEmbed = new EmbedBuilder()
                .setColor(0x05D9FF)
                .setAuthor({ name: `${ticketType} Ticket`, iconURL: guild.iconURL({ dynamic: true }) })
                .setTitle('Ticket Details')
                .setDescription(
                    `**Issued by:** <@${user.id}>\n` +
                    `**Server Invite:** ${interaction.fields?.getTextInputValue('invite_link') || 'No invite provided.'}\n` +
                    `**Reason for partnership:**\n> ${interaction.fields?.getTextInputValue('reason')?.replace(/\n/g, '\n> ') || 'No reason provided.'}\n` +
                    '```\nPlease wait patiently while we evaluate the partnership. In the meantime, if you have anything else to say do so now. Please refrain from pinging staff. Thanks!\n```'
                )
                .setFooter({ text: 'Pika Ranked Bedwars Tickets!' })
                .setTimestamp();

            row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒'),
                new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('Claim')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('<a:claim:1298228030405214269>'),
                new ButtonBuilder()
                    .setCustomId(`partnership_details_${ticketCounter}`)
                    .setLabel('Partnership Details')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('<a:attention:1298284499829784596>')
            );

            // Send the embed and capture the sent message
            console.log('Preparing to send Partnership Details embed.');
            const ticketMessage = await sendEmbed(ticketChannel, ticketInfoEmbed, row);

            if (!ticketMessage) {
                throw new Error('Failed to send the partnership embed message.');
            }

            console.log(`Partnership embed sent with Message ID: ${ticketMessage.id}`);

            // Save the partnership data in the database
            await pool.execute(
                'INSERT INTO tickets (user_id, channel_id, ticket_number, ticket_type, invite_link, reason, ticket_message_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    user.id,
                    ticketChannel.id,
                    ticketCounter,
                    ticketType,
                    interaction.fields?.getTextInputValue('invite_link') || 'No invite provided.',
                    interaction.fields?.getTextInputValue('reason') || 'No reason provided.',
                    ticketMessage.id,
                ]
            );

        } else {
            // Handle other ticket types (General, Appeal)
            ticketInfoEmbed = new EmbedBuilder()
                .setColor(0x05D9FF)
                .setAuthor({ name: `${ticketType} Ticket`, iconURL: user.displayAvatarURL() })
                .setTitle('Ticket Instructions')
                .setDescription('```Please wait patiently for staff to reply. In the meantime, please provide details about your issue. If no one replies, please refrain from mentioning staff. Thanks!```')
                .setFooter({ text: 'Pika Ranked Bedwars Tickets!' })
                .setTimestamp();

            row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒'),
                new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('Claim')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('<a:check:1256329093679681608>')
            );

            // Send the embed and capture the sent message
            console.log('Preparing to send General/Appeal Ticket embed.');
            const ticketMessage = await sendEmbed(ticketChannel, ticketInfoEmbed, row);

            if (!ticketMessage) {
                throw new Error('Failed to send the general/appeal embed message.');
            }

            console.log(`General/Appeal embed sent with Message ID: ${ticketMessage.id}`);

            // Save the ticket data in the database
            await pool.execute(
                'INSERT INTO tickets (user_id, channel_id, ticket_number, ticket_message_id, ticket_type) VALUES (?, ?, ?, ?, ?)',
                [user.id, ticketChannel.id, ticketCounter, ticketMessage.id, ticketType]
            );
        }

        // Increment the ticket counter in the database
        ticketCounter++;
        await pool.execute('UPDATE ticket_settings SET ticket_counter = ? WHERE id = 1', [ticketCounter]);
        console.log(`Ticket counter updated to ${ticketCounter}.`);

        // Send confirmation embed to the user
        const confirmationEmbed = new EmbedBuilder()
            .setColor(0x00008B)
            .setDescription(
                `**Your ticket has been opened.**\n⤿ Head over to <#${ticketChannel.id}> to discuss your issue with the staff.`
            );

        await interaction.editReply({ embeds: [confirmationEmbed] });
        console.log('Confirmation embed sent to user.');

    } catch (error) {
        console.error('Failed to create a ticket channel:', error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({
                    content: 'There was an error creating your ticket. Please try again later.',
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content: 'There was an error creating your ticket. Please try again later.',
                    ephemeral: true,
                });
            }
        } catch (followUpError) {
            console.error('Error sending follow-up message:', followUpError);
        }
    }
}

/**
 * Handles staff report ticket submissions from modals.
 * @param {Interaction} interaction 
 * @param {Client} client 
 */
async function handleStaffReportSubmission(interaction, client) {
    const { guild, user, fields } = interaction;

    // Extract form data
    const reportedUserInput = fields.getTextInputValue('reported_user');
    const reason = fields.getTextInputValue('reason');
    const proof = fields.getTextInputValue('proof');

    // Split and filter valid URLs in proof input
    const proofUrls = proof
        .split(/\s+/)
        .filter((url) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url)); // Checks for valid URL format

    if (proofUrls.length === 0) {
        await interaction.reply({
            content: 'Please provide at least one valid URL as proof.',
            ephemeral: true,
        });
        return;
    }

    // Validate all proof URLs concurrently
    const validationPromises = proofUrls.map((url) => isValidMediaUrl(url)); // Ensure isValidMediaUrl is imported
    const validationResults = await Promise.all(validationPromises);

    // Check if all URLs are valid
    const allValid = validationResults.every((result) => result === true);
    if (!allValid) {
        await interaction.reply({
            content: 'One or more proof URLs are invalid or unsupported. Please ensure all provided URLs point to valid media files.',
            ephemeral: true,
        });
        return;
    }

    // Proceed to find the reported member
    let reportedMember;

    // Try to fetch the member by ID
    try {
        reportedMember = await guild.members.fetch(reportedUserInput.replace(/[<@!>]/g, ''));
    } catch {
        // If fetching by ID fails, try to find by username
        reportedMember = guild.members.cache.find(
            (member) =>
                member.user.username.toLowerCase() === reportedUserInput.toLowerCase() ||
                member.user.tag.toLowerCase() === reportedUserInput.toLowerCase()
        );
    }

    if (!reportedMember) {
        // Reported user not found in the guild
        await interaction.reply({
            content: 'The user you are trying to report does not exist in this server. Please check the username or user ID and try again.',
            ephemeral: true,
        });
        return;
    }

    // Check if the reported user has the staff role
    const isStaff = reportedMember.roles.cache.has(config.staffRoleId);
    if (!isStaff) {
        // Instruct to create a standard report ticket
        const reportDetailsEmbed = new EmbedBuilder()
            .setColor(0xffa500) // Orange color
            .setTitle('Staff Report Validation Failed')
            .setDescription(
                `**Reported User:**\n\`\`\`${reportedUserInput}\`\`\`\n` +
                `**Reason:**\n\`\`\`${reason}\`\`\`\n` +
                `**Proof:**\n\`\`\`${proof}\`\`\`\n\n` +
                `The user you reported does not have the staff role. Please create a **standard report ticket** instead.`
            )
            .setTimestamp();

        await interaction.reply({ embeds: [reportDetailsEmbed], ephemeral: true });
        return;
    }

    // If the ticket is valid, proceed
    const data = {
        reportedUserId: reportedMember.id,
        reportedUserMention: `<@${reportedMember.id}>`,
        reason: reason,
        proofUrls: proofUrls,
    };

    // Proceed to create the ticket channel with collected data
    await handleTicketCreation(interaction, client, 'Staff Report', data);
}

/**
 * Handles partnership ticket submissions from modals.
 * @param {Interaction} interaction 
 * @param {Client} client 
 */
async function handlePartnershipSubmission(interaction, client) {
    const { guild, user, fields } = interaction;

    // Extract form data
    const inviteLink = fields.getTextInputValue('invite_link');
    const reason = fields.getTextInputValue('reason');

    // Validate the invite link
    const isValidInvite = await validateDiscordInvite(client, inviteLink); // Ensure validateDiscordInvite is imported
    if (!isValidInvite) {
        await interaction.reply({
            content: 'The provided Discord invite link is invalid or expired. Please provide a valid invite link.',
            ephemeral: true,
        });
        return;
    }

    const data = {
        inviteLink: inviteLink,
        reason: reason,
    };

    // Proceed to create the ticket channel with collected data
    await handleTicketCreation(interaction, client, 'Partnership', data);
}

module.exports = {
    handleTicketCreation,
    handleStaffReportSubmission,
    handlePartnershipSubmission,
};
