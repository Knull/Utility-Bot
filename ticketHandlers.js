const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    InteractionType,
  } = require('discord.js');
  const { exportChatLogs } = require('./chatLogger');
  const fs = require('fs');
  const path = require('path');
  const config = require('./config');
  const mysql = require('mysql2/promise');
  
  const pool = mysql.createPool({
    host: '216.225.202.122',
    user: 'user_phpmyadmin',
    password: 'SepHup9ePRap@lch2tRO', // Replace with your actual database password
    database: 'PRBW',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  const axios = require('axios');

/**
 * Validates whether a given URL points to an allowed media type.
 * @param {string} url - The URL to validate.
 * @returns {Promise<boolean>} - Returns true if valid, else false.
 */
async function isValidMediaUrl(url) {
  try {
    const response = await axios.head(url, { timeout: 5000 });
    const contentType = response.headers['content-type'];
    // Define allowed MIME types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'application/pdf', // If PDFs are allowed as proof
      // Add more as needed
    ];
    return allowedTypes.includes(contentType);
  } catch (error) {
    console.error(`Failed to validate URL: ${url}`, error.message);
    return false;
  }
}

/**
 * Validates a Discord invite link.
 * @param {Client} client - The Discord client.
 * @param {string} inviteLink - The invite link to validate.
 * @returns {Promise<boolean>} - Returns true if valid, else false.
 */
async function validateDiscordInvite(client, inviteLink) {
  try {
    const invite = await client.fetchInvite(inviteLink);
    return !!invite;
  } catch (error) {
    console.error('Invite validation error:', error.message);
    return false;
  }
}

/**
 * Sends a plain text message to a channel and returns the sent message.
 * @param {GuildChannel} channel - The channel to send the message to.
 * @param {string} content - The plain text content.
 * @returns {Promise<Message>} - The sent message object.
 */
async function sendPlainText(channel, content) {
  return await channel.send(content);
}

/**
 * Sends an embed to a channel and returns the sent message.
 * @param {GuildChannel} channel - The channel to send the embed to.
 * @param {EmbedBuilder} embed - The embed to send.
 * @param {ActionRowBuilder} [components] - Optional components (buttons).
 * @returns {Promise<Message>} - The sent message object.
 */
async function sendEmbed(channel, embed, components) {
  const payload = { embeds: [embed] };
  if (components) payload.components = [components];
  
  try {
    console.log(`Sending embed to channel ${channel.id}.`);
    const message = await channel.send(payload);
    console.log(`Embed sent successfully. Message ID: ${message.id}`);
    return message;
  } catch (error) {
    console.error('Failed to send embed:', error);
    throw error;
  }
}

  function getCategoryId(ticketType, isArchived = false) {
    const categoryMapping = {
      'General': isArchived ? config.archivedGeneralTicketsCategoryId : config.generalTicketsCategoryId,
      'Appeal': isArchived ? config.archivedAppealTicketsCategoryId : config.appealTicketsCategoryId,
      'Report': isArchived ? config.archivedReportTicketsCategoryId : config.reportTicketsCategoryId,
      'Staff Report': isArchived ? config.archivedStaffReportTicketsCategoryId : config.staffReportTicketsCategoryId,
      'Partnership': isArchived ? config.archivedPartnershipTicketsCategoryId : config.partnershipTicketsCategoryId,
    };
  
    return categoryMapping[ticketType] || (isArchived ? config.archivedTicketsCategoryId : config.ticketsCategoryId);
  }
  async function setupTicketSystem(client) {
    try {
      const ticketsChannelId = config.ticketsChannelId;
      const ticketsChannel = await client.channels.fetch(ticketsChannelId);
      if (!ticketsChannel) {
        console.error('Failed to fetch the tickets channel.');
        return;
      }
  
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Need Assistance?')
        .setDescription(
          '- **<:general:1298227239069945888> General ➤** Need help? Get assistance here.\n' +
            '- **⚖️ Appeal ➤** Appeal a ban or mute here.\n' +
            '- **🚩 Report ➤** Report a player here.\n' +
            '- **👮 Staff Report ➤** Report a staff member here.\n' +
            '- **<a:partnership:1298227428866527285> Partnership ➤** Apply to be a server partner here.'
        );
  
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('create_general').setStyle(ButtonStyle.Secondary).setEmoji('<:general:1298227239069945888>'),
        new ButtonBuilder().setCustomId('create_appeal').setStyle(ButtonStyle.Secondary).setEmoji('⚖️'),
        new ButtonBuilder().setCustomId('create_report').setStyle(ButtonStyle.Secondary).setEmoji('🚩'),
        new ButtonBuilder().setCustomId('create_staff_report').setStyle(ButtonStyle.Secondary).setEmoji('👮'),
        new ButtonBuilder().setCustomId('create_partnership').setStyle(ButtonStyle.Secondary).setEmoji('<a:partnership:1298227428866527285>')
      );
  
      const messages = await ticketsChannel.messages.fetch({ limit: 10 });
      const setupMessageExists = messages.some(
        (message) =>
          message.author.id === client.user.id &&
          message.embeds.length > 0 &&
          message.embeds[0].title === 'Need Assistance?'
      );
  
      if (!setupMessageExists) {
        await ticketsChannel.send({ embeds: [embed], components: [row] });
        console.log('Ticket system setup message sent.');
      } else {
        console.log('Ticket system setup message already exists.');
      }
    } catch (error) {
      console.error('Error in ticketing system setup:', error);
    }
  }
  
async function handleInteraction(client, interaction) {
    try {
      if (interaction.isButton()) {
        const { customId } = interaction;
        console.log(`Button interaction received: ${customId}`);
  
        if (customId.startsWith('evidence_')) {
          await handleEvidenceButton(interaction);
        } else if (customId.startsWith('report_details_')) {
          await handleReportDetails(interaction);
        } else if (customId.startsWith('partnership_details_')) {
          await handlePartnershipDetails(interaction);
        } else {
          if (['create_general', 'create_appeal', 'close_ticket'].includes(customId)) {
            await interaction.deferReply({ ephemeral: true });
          }
  
          switch (customId) {
            case 'create_general':
            case 'create_appeal':
              await handleTicketCreation(interaction, customId);
              break;
            case 'create_report':
            case 'create_staff_report':
            case 'create_partnership':
              await showTicketModal(interaction, customId);
              break;
            case 'close_ticket':
              await handleCloseTicket(interaction);
              break;
            case 'claim_ticket':
              await promptReason(client, interaction, 'claim_ticket');
              break;
            case 'delete_ticket':
              await promptReason(client, interaction, 'delete_ticket');
              break;
            case 'reopen_ticket':
              await handleReopenTicket(interaction);
              break;
            default:
              break;
          }
        }
      } else if (interaction.isCommand()) {
        const { commandName } = interaction;
  
        // Handle slash commands
        if (commandName === 'add') {
          await handleAddCommand(interaction);
        } else if (commandName === 'close') {
          await handleCloseTicket(interaction);
        } else if (commandName === 'claim') {
          const reason = interaction.options.getString('reason', true);
          await handleClaimCommand(interaction, reason);
        }
      } else if (interaction.type === InteractionType.ModalSubmit) {
        // Handle modal submissions
        console.log(`Modal submit interaction received: ${interaction.customId}`);
        if (interaction.customId.startsWith('modal_')) {
          const ticketType = interaction.customId.replace('modal_', '');
          await handleModalSubmission(interaction, ticketType);
        } else if (interaction.customId.startsWith('reason_')) {
          const reason = interaction.fields.getTextInputValue('reason');
          if (interaction.customId === 'reason_claim_ticket') {
            await handleClaimTicket(client, interaction, reason);
          } else if (interaction.customId === 'reason_delete_ticket') {
            await handleDeleteTicket(client, interaction, reason);
          }
        }
      }
    } catch (error) {
      console.error('Error handling interaction:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'An error occurred while processing your request.',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: 'An error occurred while processing your request.',
          ephemeral: true,
        });
      }
    }
  }
  
  
  
  async function handleEvidenceButton(interaction) {
    const ticketNumber = interaction.customId.split('_').pop();
  
    // Fetch the ticket data from the database using ticket_number
    const [ticketRows] = await pool.execute('SELECT * FROM tickets WHERE ticket_number = ?', [ticketNumber]);
    if (ticketRows.length === 0) {
      return interaction.reply({ content: 'Ticket not found.', ephemeral: true });
    }
    const ticketData = ticketRows[0];
  
    if (!ticketData.proof_urls) {
      return interaction.reply({ content: 'No evidence provided.', ephemeral: true });
    }
  
    const proofUrls = JSON.parse(ticketData.proof_urls);
  
    // Prepare to send the evidence
    const embeds = [];
    proofUrls.forEach((url, index) => {
      const embed = new EmbedBuilder()
        .setTitle(`Evidence ${index + 1}`)
        .setColor(0x3ce1ff)
        .setImage(url)
        .setTimestamp();
      embeds.push(embed);
    });
  
    // Due to Discord's limitations, we can send up to 10 embeds per message
    if (embeds.length > 10) {
      // Split the embeds into chunks of 10
      const embedChunks = [];
      for (let i = 0; i < embeds.length; i += 10) {
        embedChunks.push(embeds.slice(i, i + 10));
      }
  
      // Send each chunk separately
      for (const chunk of embedChunks) {
        await interaction.followUp({ embeds: chunk, ephemeral: true });
      }
    } else {
      await interaction.reply({ embeds, ephemeral: true });
    }
  }
  
  async function handlePartnershipDetails(interaction) {
    try {
      const channel = interaction.channel;
      const guild = interaction.guild;
  
      // Extract ticket number from customId
      const ticketNumber = interaction.customId.split('_').pop();
  
      // Fetch the ticket data from the database
      const [ticketRows] = await pool.execute('SELECT * FROM tickets WHERE ticket_number = ?', [ticketNumber]);
      if (ticketRows.length === 0) {
        return interaction.reply({ content: 'Ticket not found in the database.', ephemeral: true });
      }
      const ticketData = ticketRows[0];
  
      // Extract necessary data
      const ticketType = ticketData.ticket_type;
      const issuedBy = `<@${ticketData.user_id}>`;
      const inviteLink = ticketData.invite_link;
      const reason = ticketData.reason.replace(/\n/g, '\n> ');
  
      // Create the detailed partnership embed
      const partnershipDetailsEmbed = new EmbedBuilder()
        .setColor(0x3498db) // Example color
        .setAuthor({ name: `Ticket | ${ticketNumber}`, iconURL: guild.iconURL({ dynamic: true }) })
        .setTitle(`${ticketType} Details`)
        .setDescription(
          `**Issued by:** ${issuedBy}\n` +
          `**Server Invite:** [Click Here](${inviteLink})\n` +
          `**Reason for Partnership:**\n> ${reason}`
        )
        .setTimestamp();
  
      await interaction.reply({ embeds: [partnershipDetailsEmbed], ephemeral: true });
    } catch (error) {
      console.error('Error handling partnership details:', error);
      await interaction.reply({ content: 'Failed to retrieve partnership details.', ephemeral: true });
    }
  }
  
    
  async function showTicketModal(interaction, customId) {
    const ticketTypeMap = {
      create_report: 'Report',
      create_staff_report: 'Staff Report',
      create_partnership: 'Partnership',
    };
  
    const ticketType = ticketTypeMap[customId];
  
    const modal = new ModalBuilder()
      .setCustomId(`modal_${ticketType.replace(' ', '_').toLowerCase()}`)
      .setTitle(`${ticketType} Ticket`);
  
    if (ticketType === 'Report' || ticketType === 'Staff Report') {
        const userField = new TextInputBuilder()
        .setCustomId('reported_user')
        .setLabel('Username/User ID of reported player') // Shortened label
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      
      const reasonField = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason (be descriptive)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);
      
        const proofField = new TextInputBuilder()
        .setCustomId('proof')
        .setLabel('Proof (attachment URLs)')
        .setStyle(TextInputStyle.Paragraph) // Changed to Paragraph for multiple URLs
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(userField),
        new ActionRowBuilder().addComponents(reasonField),
        new ActionRowBuilder().addComponents(proofField)
      );
    } else if (ticketType === 'Partnership') {
      const inviteField = new TextInputBuilder()
        .setCustomId('invite_link')
        .setLabel('Discord Invite Link to your server')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
  
      const reasonField = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Why should we partner?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);
  
      modal.addComponents(
        new ActionRowBuilder().addComponents(inviteField),
        new ActionRowBuilder().addComponents(reasonField)
      );
    }
  
    await interaction.showModal(modal);
  }
  
  
  async function handleModalSubmission(interaction, ticketTypeKey) {
    const ticketType = ticketTypeKey
      .replace('_', ' ')
      .replace('modal_', '')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  
    const data = {};
    const fields = interaction.fields;
  
    if (ticketType === 'Report' || ticketType === 'Staff Report') {
      const reportedUserInput = fields.getTextInputValue('reported_user');
      const reason = fields.getTextInputValue('reason');
      const proof = fields.getTextInputValue('proof');
  
      // Split and filter proof URLs
      const proofUrls = proof.split(/\s+/).filter((url) => url.startsWith('http'));
  
      // Validate all proof URLs concurrently
      const validationPromises = proofUrls.map((url) => isValidMediaUrl(url));
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
      const guild = interaction.guild;
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
  
      if (ticketType === 'Staff Report') {
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
      }
  
      // If the ticket is valid, proceed
      data.reportedUserId = reportedMember.id;
      data.reportedUserMention = `<@${reportedMember.id}>`;
      data.reason = reason;
      data.proofUrls = proofUrls;
  
      // Proceed to create the ticket channel with collected data
      await createTicketChannel(interaction, ticketType, data);
    } else if (ticketType === 'Partnership') {
      const inviteLink = fields.getTextInputValue('invite_link');
      const reason = fields.getTextInputValue('reason');
  
      // Validate the invite link
      const isValidInvite = await validateDiscordInvite(interaction.client, inviteLink);
      if (!isValidInvite) {
        await interaction.reply({
          content: 'The provided Discord invite link is invalid or expired. Please provide a valid invite link.',
          ephemeral: true,
        });
        return;
      }
  
      data.inviteLink = inviteLink;
      data.reason = reason;
  
      // Proceed to create the ticket channel with collected data
      await createTicketChannel(interaction, ticketType, data);
    } else {
      // Handle other ticket types (e.g., General, Appeal)
      // Assuming similar validation if needed
      await handleTicketCreation(interaction, ticketType.toLowerCase());
    }
  }

  
  
  
  function getPermissionOverwrites(guild, userId, ticketType) {
    console.log(`--- Begin Permission Setup ---`);
    console.log(`Ticket Type: ${ticketType}`);
    console.log(`Guild ID: ${guild.id}, User ID: ${userId}`);
    
    // Ensure all IDs are strings
    const overwrites = [
      {
        id: String(guild.roles.everyone.id),
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: String(userId),
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      },
    ];
  
    // Function to safely map permissions
    const safeMapPermissions = (permissions) => permissions.map(p => p.toString());
  
    // Create a version of overwrites suitable for logging (convert BigInt to strings)
    const logOverwrites = overwrites.map(ow => ({
      id: ow.id,
      allow: ow.allow ? safeMapPermissions(ow.allow) : [],
      deny: ow.deny ? safeMapPermissions(ow.deny) : [],
    }));
    
    console.log('Base overwrites setup:', JSON.stringify(logOverwrites, null, 2));
  
    if (['General', 'Report'].includes(ticketType)) {
      console.log(`Adding permissions for Staff in General/Report ticket`);
      overwrites.push({
        id: String(config.staffRoleId),
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    } else if (['Staff Report', 'Partnership'].includes(ticketType)) {
      console.log(`Adding permissions for Admin in Staff Report/Partnership ticket`);
      overwrites.push({
        id: String(config.adminRoleId),
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    } else if (ticketType === 'Appeal') {
      console.log(`Setting permissions for Appeal ticket (Admin only)`);
      overwrites.push(
        {
          id: String(config.staffRoleId),
          deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
        {
          id: String(config.adminRoleId),
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        }
      );
    }
  
    // Create a final version of overwrites suitable for logging
    const finalLogOverwrites = overwrites.map(ow => ({
      id: ow.id,
      allow: ow.allow ? safeMapPermissions(ow.allow) : [],
      deny: ow.deny ? safeMapPermissions(ow.deny) : [],
    }));
    
    console.log(`Final overwrites for ticket type "${ticketType}":`, JSON.stringify(finalLogOverwrites, null, 2));
    console.log(`--- End Permission Setup ---`);
  
    return overwrites;
  }
  
  
  
  function safeStringify(obj, indent = 2) {
    return JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    , indent);
  }
  
  
  
  
  
  
  
  async function createTicketChannel(interaction, ticketType, data) {
    console.log(`createTicketChannel called for interaction ID: ${interaction.id} with ticketType: ${ticketType}`);

    const { guild, user } = interaction;

    try {
        // Defer the interaction
        await interaction.deferReply({ ephemeral: true });
        console.log('Interaction deferred successfully.');

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

        let ticketInfoEmbed;
        const row = new ActionRowBuilder();

        // Handle different ticket types
        if (ticketType === 'Report' || ticketType === 'Staff Report') {
            ticketInfoEmbed = new EmbedBuilder()
                .setColor(0x05D9FF)
                .setAuthor({ name: `${ticketType} Ticket`, iconURL: guild.iconURL({ dynamic: true }) })
                .setTitle('Ticket Details')
                .setDescription(
                    `**Issued by:** <@${user.id}>\n` +
                    `**Reported User:** ${data.reportedUserMention}\n` +
                    `**Reason:**\n> ${data.reason.replace(/\n/g, '\n> ')}\n` +
                    '```\nPlease wait patiently for staff to evaluate the evidence. In the meantime, if you have anything else to add, do so now. Refrain from pinging staff, please.\n```'
                )
                .setFooter({ text: 'Pika Ranked Bedwars Tickets!' })
                .setTimestamp();

            // Add buttons
            row.addComponents(
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
                    .setEmoji('<a:attention:1298284499829784596>') // Replace with your desired emoji
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
                'INSERT INTO tickets (user_id, channel_id, ticket_number, ticket_type, reported_user, reason, proof_urls) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    user.id,
                    ticketChannel.id,
                    ticketCounter,
                    ticketType,
                    data.reportedUserMention,
                    data.reason,
                    JSON.stringify(data.proofUrls),
                ]
            );

            // Update ticket with ticket message ID
            await pool.execute('UPDATE tickets SET ticket_message_id = ? WHERE channel_id = ?', [
                ticketMessage.id,
                ticketChannel.id,
            ]);

        } else if (ticketType === 'Partnership') {
            // Similar logic for Partnership tickets
            ticketInfoEmbed = new EmbedBuilder()
                .setColor(0x05D9FF)
                .setAuthor({ name: `${ticketType} Ticket`, iconURL: guild.iconURL({ dynamic: true }) })
                .setTitle('Ticket Details')
                .setDescription(
                    `**Issued by:** <@${user.id}>\n` +
                    `**Server Invite:** ${data.inviteLink}\n` +
                    `**Reason for partnership:**\n> ${data.reason.replace(/\n/g, '\n> ')}\n` +
                    '```\nPlease wait patiently while we evaluate the partnership. In the meantime, if you have anything else to say do so now. Please refrain from pinging staff. Thanks!\n```'
                )
                .setFooter({ text: 'Pika Ranked Bedwars Tickets!' })
                .setTimestamp();

            // Add buttons
            row.addComponents(
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
                    .setEmoji('<a:attention:1298284499829784596>') // Replace with your desired emoji
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
                'INSERT INTO tickets (user_id, channel_id, ticket_number, ticket_type, invite_link, reason) VALUES (?, ?, ?, ?, ?, ?)',
                [user.id, ticketChannel.id, ticketCounter, ticketType, data.inviteLink, data.reason]
            );

            // Update ticket with ticket message ID
            await pool.execute('UPDATE tickets SET ticket_message_id = ? WHERE channel_id = ?', [
                ticketMessage.id,
                ticketChannel.id,
            ]);

        } else {
            // Handle other ticket types (General, Appeal)
            ticketInfoEmbed = new EmbedBuilder()
                .setColor(0x05D9FF)
                .setAuthor({ name: `${ticketType} Ticket`, iconURL: guild.iconURL({ dynamic: true }) })
                .setTitle('Ticket Instructions')
                .setDescription('```Please wait patiently for staff to reply. In the meantime, please provide details about your issue. If no one replies, please refrain from mentioning staff. Thanks!```')
                .setFooter({ text: 'Pika Ranked Bedwars Tickets!' })
                .setTimestamp();

            // Add buttons
            row.addComponents(
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
                'INSERT INTO tickets (user_id, channel_id, ticket_number, ticket_type) VALUES (?, ?, ?, ?)',
                [user.id, ticketChannel.id, ticketCounter, ticketType]
            );

            // Update ticket with ticket message ID
            await pool.execute('UPDATE tickets SET ticket_message_id = ? WHERE channel_id = ?', [
                ticketMessage.id,
                ticketChannel.id,
            ]);
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


  
  

async function handleTicketCreation(interaction, type) {
  const { guild, user } = interaction;

  try {
      // Fetch the current ticket counter from the database
      const [settingsRows] = await pool.execute('SELECT * FROM ticket_settings WHERE id = 1');
      let ticketCounter = settingsRows[0].ticket_counter;
      const prefix = '┃'; // Fixed prefix

      // Mapping customId to ticket type
      const ticketTypeMap = {
          'create_general': 'General',
          'create_appeal': 'Appeal',
          'create_report': 'Report',
          'create_staff_report': 'Staff Report',
          'create_partnership': 'Partnership',
      };

      const ticketType = ticketTypeMap[type] || 'Ticket';

      // Process the username to remove special characters or spaces
      let username = user.username.split(/[\s\W_]+/)[0]; // Split username at non-alphanumeric characters
      username = username || user.username; // If username is empty after split, use the full username

      const ticketChannelName = `${ticketCounter}${prefix}${username}`;

      // **Use getPermissionOverwrites instead of hardcoding**
      const permissionOverwrites = getPermissionOverwrites(guild, user.id, ticketType);
      const parentCategoryId = getCategoryId(ticketType);

      // Create the ticket channel with the correct permissions
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

        // The rest of your code remains the same
        const ticketInfoEmbed = new EmbedBuilder()
            .setColor(0x05D9FF)
            .setAuthor({ name: `${ticketType} Ticket`, iconURL: user.displayAvatarURL() })
            .setTitle('Ticket Instructions')
            .setDescription('```Please wait patiently for staff to reply, in the meantime please provide details about your issue. If no one replies please refrain from mentioning staff. Thanks!```')
            .setColor(0x05D9FF) // Use your preferred color
            .setFooter({ text: 'Pika Ranked Bedwars Tickets!' });

        const row = new ActionRowBuilder().addComponents(
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

        await ticketChannel.send(`Hey <@${user.id}> 👋!\nPlease wait patiently!`);
        const ticketMessage = await ticketChannel.send({ embeds: [ticketInfoEmbed], components: [row] });

        // Insert ticket information into the database, including the ticket instruction message ID
        await pool.execute(
            'INSERT INTO tickets (user_id, channel_id, ticket_number, ticket_message_id, ticket_type) VALUES (?, ?, ?, ?, ?)',
            [user.id, ticketChannel.id, ticketCounter, ticketMessage.id, ticketType]
        );

        // Increment the ticket counter in the database
        ticketCounter++;
        await pool.execute('UPDATE ticket_settings SET ticket_counter = ? WHERE id = 1', [ticketCounter]);

        const confirmationEmbed = new EmbedBuilder()
            .setColor(0x00008B)
            .setDescription(
                `**Your ticket has been opened.**\n⤿ Head over to <#${ticketChannel.id}> to discuss your issue with the staff.`
            );

        // Since the interaction has been deferred, we use editReply
        await interaction.editReply({ embeds: [confirmationEmbed] });
    } catch (error) {
        console.error('Failed to create a ticket channel:', error);
        // Since the interaction is deferred, we use followUp
        await interaction.followUp({
            content: 'There was an error creating your ticket. Please try again later.',
            ephemeral: true,
        });
    }
}


async function handleCloseTicket(interaction) {
    try {
      const channel = interaction.channel;
      const user = interaction.user;
  
      // Fetch the ticket data from the database
      const [ticketRows] = await pool.execute('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
      if (ticketRows.length === 0) {
        return interaction.reply({ content: 'Ticket not found in the database.', ephemeral: true });
      }
      const ticketData = ticketRows[0];
  
      const closeEmbed = new EmbedBuilder()
        .setColor(0xffff00)
        .setDescription(`Ticket closed by <@${user.id}>`);
  
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('delete_ticket')
          .setLabel('Delete')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⛔'),
        new ButtonBuilder()
          .setCustomId('reopen_ticket')
          .setLabel('Reopen')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔓')
      );
  
      // Update ticket status in the database
      await pool.execute('UPDATE tickets SET status = ? WHERE channel_id = ?', ['closed', channel.id]);
  
      // Remove the user from the channel permissions
      await channel.permissionOverwrites.edit(ticketData.user_id, {
        ViewChannel: false,
        SendMessages: false,
      });
  
      // Disable the "Close" and "Claim" buttons in the ticket instruction message
      const ticketMessageId = ticketData.ticket_message_id;
      if (ticketMessageId) {
        const ticketMessage = await channel.messages.fetch(ticketMessageId);
        if (ticketMessage) {
          const updatedComponents = ticketMessage.components[0].components.map((button) => {
            if (button.customId === 'close_ticket' || button.customId === 'claim_ticket') {
              return ButtonBuilder.from(button).setDisabled(true);
            }
            return button;
          });
  
          const updatedRow = new ActionRowBuilder().addComponents(updatedComponents);
          await ticketMessage.edit({ components: [updatedRow] });
        }
      }
  
      await channel.send({ embeds: [closeEmbed], components: [confirmRow] });
      const archivedCategoryId = getCategoryId(ticketData.ticket_type, true);
  
      // Move the channel to the archived category
      await channel.setParent(archivedCategoryId, { lockPermissions: false });
  
      // Respond to the interaction
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'Ticket successfully closed.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Ticket successfully closed.', ephemeral: true });
      }
    } catch (error) {
      console.error('Error closing the ticket:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'Failed to close the ticket.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Failed to close the ticket.', ephemeral: true });
      }
    }
  }
  
  async function handleClaimTicket(client, interaction, reason) {
    try {
        console.log('Interaction received:', interaction.customId);
        console.log('Channel:', interaction.channel.name);
        console.log('User:', interaction.user.tag);

        const { guild, channel, user } = interaction;

        // Check if the user has the staff role
        if (!interaction.member.roles.cache.has(config.staffRoleId)) {
            const embed = new EmbedBuilder()
                .setColor(0xff0000) // Red color for errors
                .setDescription(`> Only <@&${config.staffRoleId}> can use this command.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Fetch the ticket data from the database
        const [ticketRows] = await pool.execute('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
        if (ticketRows.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setDescription('Ticket not found in the database.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
        const ticketData = ticketRows[0];

        // Update ticket status and claimed_by in the database
        await pool.execute(
            'UPDATE tickets SET status = ?, claimed_by = ? WHERE channel_id = ?',
            ['claimed', user.id, channel.id]
        );

        // Defer the reply to acknowledge the interaction
        await interaction.deferReply({ ephemeral: true });

        const ticketCounter = ticketData.ticket_number;
        const ticketCreatorId = ticketData.user_id;
        const ticketCreator = await guild.members.fetch(ticketCreatorId).catch(() => null);
        const ticketCreatorUsername = ticketCreator ? ticketCreator.user.username : 'Unknown User';

        // Extract ticket type from the database
        const ticketType = ticketData.ticket_type || 'General';
        const ticketTypeCapitalized = ticketType.charAt(0).toUpperCase() + ticketType.slice(1);

        console.log('Claim ticket action initiated, attempting to export chat logs.');
        console.log(`Ticket Details:\nUser: ${ticketCreatorUsername}\nClaimed by: ${user.username}\nReason: ${reason}`);

        const outputFile = `chat_${channel.name}.html`;
        const limit = 1000;
        const tzInfo = 'UTC';
        const militaryTime = true;

        // Export chat logs
        exportChatLogs(config.token, channel.id, outputFile, limit, tzInfo, militaryTime, async (err, filePath) => {
            if (err) {
                console.error('Error exporting chat logs:', err);
                return await interaction.followUp({ content: 'Failed to claim the ticket.', ephemeral: true });
            }

            console.log(`Chat logs successfully exported to ${filePath}`);

            // Send the transcript via DM to a specific user (your alt account)
            const transcriptRecipientId = '1271511630278164514'; // Replace with your actual user ID
            const transcriptRecipient = await client.users.fetch(transcriptRecipientId);
            const message = await transcriptRecipient.send({ files: [filePath] });
            const transcriptUrl = message.attachments.first()?.url;

            if (!transcriptUrl) {
                return await interaction.followUp({ content: 'Failed to obtain transcript URL.', ephemeral: true });
            }

            // Update the ticket in the database with the transcript URL
            await pool.execute('UPDATE tickets SET transcript_url = ? WHERE channel_id = ?', [
                transcriptUrl,
                channel.id,
            ]);

            // Build the main log embed
            const logEmbed = new EmbedBuilder()
                .setAuthor({ name: `${ticketTypeCapitalized} Ticket`, iconURL: guild.iconURL({ dynamic: true }) })
                .setTitle(`${ticketCounter} | ${ticketCreatorUsername}`)
                .setColor(0x3ce1ff) // Light blue color
                .setTimestamp()
                .setDescription(
                    `> **Ticket Claimed ➤** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
                    `> **Claimed by ➤** <@${user.id}>\n` +
                    `> **Reason ➤** \`${reason}\``
                );

            // Prepare buttons for logs channel
            const logRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('View Transcript')
                    .setStyle(ButtonStyle.Link)
                    .setURL(transcriptUrl)
            );

            // Add "Report Details" or "Partnership Details" based on ticket type
            if (ticketType === 'Report' || ticketType === 'Staff Report') {
                if (ticketData.proof_urls) {
                    logRow.addComponents(
                        new ButtonBuilder()
                            .setLabel('View Evidence')
                            .setStyle(ButtonStyle.Primary)
                            .setCustomId(`evidence_${ticketCounter}`)
                            .setEmoji('📁')
                    );
                }

                // Add "Report Details" button
                logRow.addComponents(
                    new ButtonBuilder()
                        .setLabel('Report Details')
                        .setStyle(ButtonStyle.Primary)
                        .setCustomId(`report_details_${ticketCounter}`)
                        .setEmoji('<a:attention:1298284499829784596>') // Using your specified animated emoji
                );
            } else if (ticketType === 'Partnership') {
                // Add "Partnership Details" button
                logRow.addComponents(
                    new ButtonBuilder()
                        .setLabel('Partnership Details')
                        .setStyle(ButtonStyle.Primary)
                        .setCustomId(`partnership_details_${ticketCounter}`)
                        .setEmoji('<a:attention:1298284499829784596>') // Replace with your actual custom emoji
                );
            }

            // Determine the appropriate logs channel based on ticket type
            let logsChannelId;
            if (ticketType === 'Staff Report' || ticketType === 'Partnership') {
                logsChannelId = config.ticketLogsChannelId2;
            } else {
                logsChannelId = config.ticketLogsChannelId1;
            }

            const logsChannel = await guild.channels.fetch(logsChannelId);
            if (!logsChannel) {
                console.error(`Logs channel with ID ${logsChannelId} not found.`);
                return await interaction.followUp({ content: 'Failed to locate the logs channel.', ephemeral: true });
            }

            await logsChannel.send({ embeds: [logEmbed], components: [logRow] });
            console.log('Log embed sent to the logs channel.');

            // Build the embed for the user (DM) with only the "View Transcript" button
            const userLogEmbed = new EmbedBuilder(logEmbed.data); // Clone the logEmbed
            // Optionally, you can customize the embed further for the user

            // Prepare buttons for user DM
            const userRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('View Transcript')
                    .setStyle(ButtonStyle.Link)
                    .setURL(transcriptUrl)
            );

            // Send the embed to the ticket creator (DM)
            if (ticketCreator) {
                await ticketCreator.send({ embeds: [userLogEmbed], components: [userRow] }).catch(console.error);
                console.log(`Log embed sent to user DM: ${ticketCreator.user.tag}`);
            }

            // Remove the exported chat log file after uploading
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) {
                    console.error('Error deleting the exported chat log file:', unlinkErr);
                } else {
                    console.log('Exported chat log file deleted:', filePath);
                }
            });

            // Send a confirmation message before deleting the channel
            await interaction.followUp({ content: 'Ticket successfully claimed and closed.', ephemeral: true });

            // Delete the ticket channel
            await channel.delete();
            console.log(`Ticket channel ${channel.name} deleted.`);
        });
    } catch (error) {
        console.error('Error claiming the ticket:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Failed to claim the ticket.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Failed to claim the ticket.', ephemeral: true });
        }
    }
}
  
  
  
  async function handleReportDetails(interaction) {
    try {
      const channel = interaction.channel;
      const guild = interaction.guild;
  
      // Extract ticket number from customId
      const ticketNumber = interaction.customId.split('_').pop();
  
      // Fetch the ticket data from the database
      const [ticketRows] = await pool.execute('SELECT * FROM tickets WHERE ticket_number = ?', [ticketNumber]);
      if (ticketRows.length === 0) {
        return interaction.reply({ content: 'Ticket not found in the database.', ephemeral: true });
      }
      const ticketData = ticketRows[0];
  
      // Extract necessary data
      const ticketType = ticketData.ticket_type;
      const issuedBy = `<@${ticketData.user_id}>`;
      const reportedUser = ticketData.reported_user; // Stored as <@ID>
      const reason = ticketData.reason.replace(/\n/g, '\n> ');
  
      // Create the detailed report embed
      const reportDetailsEmbed = new EmbedBuilder()
        .setColor(0xe74c3c) // #e74c3c
        .setAuthor({ name: `Ticket | ${ticketNumber}`, iconURL: guild.iconURL({ dynamic: true }) })
        .setTitle(`${ticketType} Details`)
        .setDescription(
          `**Issued by:** ${issuedBy}\n` +
          `**Reported User:** ${reportedUser}\n` +
          `**Reason:**\n> ${reason}`
        )
        .setTimestamp();
  
      await interaction.reply({ embeds: [reportDetailsEmbed], ephemeral: true });
    } catch (error) {
      console.error('Error handling report details:', error);
      await interaction.reply({ content: 'Failed to retrieve report details.', ephemeral: true });
    }
  }
  
  
  async function handleClaimCommand(interaction, reason) {
    // The implementation is similar to handleClaimTicket
    await handleClaimTicket(interaction.client, interaction, reason);
  }
  
  async function handleDeleteTicket(client, interaction, reason) {
    try {
        const { guild, channel, user } = interaction;

        // Check if the user has the staff role
        if (!interaction.member.roles.cache.has(config.staffRoleId)) {
            const embed = new EmbedBuilder()
                .setColor(0xff0000) // Red color for errors
                .setDescription(`> Only <@&${config.staffRoleId}> can use this command.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Fetch the ticket data from the database
        const [ticketRows] = await pool.execute('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
        if (ticketRows.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setDescription('Ticket not found in the database.');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
        const ticketData = ticketRows[0];

        // Update ticket status in the database
        await pool.execute('UPDATE tickets SET status = ? WHERE channel_id = ?', ['deleted', channel.id]);

        // Defer the reply to acknowledge the interaction
        await interaction.deferReply({ ephemeral: true });

        const ticketCounter = ticketData.ticket_number;
        const ticketCreatorId = ticketData.user_id;
        const ticketCreator = await guild.members.fetch(ticketCreatorId).catch(() => null);
        const ticketCreatorUsername = ticketCreator ? ticketCreator.user.username : 'Unknown User';

        // Extract ticket type from the database
        const ticketType = ticketData.ticket_type || 'General';
        const ticketTypeCapitalized = ticketType.charAt(0).toUpperCase() + ticketType.slice(1);

        console.log('Delete ticket action initiated, attempting to export chat logs.');
        console.log(`Ticket Details:\nUser: ${ticketCreatorUsername}\nDeleted by: ${user.username}\nReason: ${reason}`);

        const outputFile = `chat_${channel.name}.html`;
        const limit = 1000;
        const tzInfo = 'UTC';
        const militaryTime = true;

        // Export chat logs
        exportChatLogs(config.token, channel.id, outputFile, limit, tzInfo, militaryTime, async (err, filePath) => {
            if (err) {
                console.error('Error exporting chat logs:', err);
                return await interaction.followUp({ content: 'Failed to delete the ticket.', ephemeral: true });
            }

            console.log(`Chat logs successfully exported to ${filePath}`);

            // Send the transcript via DM to a specific user (your alt account)
            const transcriptRecipientId = '1271511630278164514'; // Replace with your actual user ID
            const transcriptRecipient = await client.users.fetch(transcriptRecipientId);
            const message = await transcriptRecipient.send({ files: [filePath] });
            const transcriptUrl = message.attachments.first()?.url;

            if (!transcriptUrl) {
                return await interaction.followUp({ content: 'Failed to obtain transcript URL.', ephemeral: true });
            }

            // Update the ticket in the database with the transcript URL
            await pool.execute('UPDATE tickets SET transcript_url = ? WHERE channel_id = ?', [
                transcriptUrl,
                channel.id,
            ]);

            // Build the main log embed
            const logEmbed = new EmbedBuilder()
                .setAuthor({ name: `${ticketTypeCapitalized} Ticket`, iconURL: guild.iconURL({ dynamic: true }) })
                .setTitle(`${ticketCounter} | ${ticketCreatorUsername}`)
                .setColor(0xbd0000) // Dark red color for deletions
                .setTimestamp()
                .setDescription(
                    `> **Ticket Deleted ➤** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
                    `> **Deleted by ➤** <@${user.id}>\n` +
                    `> **Reason ➤** \`${reason}\``
                );

            // Prepare buttons for logs channel
            const logRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('View Transcript')
                    .setStyle(ButtonStyle.Link)
                    .setURL(transcriptUrl)
            );

            // Add "Report Details" or "Partnership Details" based on ticket type
            if (ticketType === 'Report' || ticketType === 'Staff Report') {
                if (ticketData.proof_urls) {
                    logRow.addComponents(
                        new ButtonBuilder()
                            .setLabel('View Evidence')
                            .setStyle(ButtonStyle.Primary)
                            .setCustomId(`evidence_${ticketCounter}`)
                            .setEmoji('📁')
                    );
                }

                // Add "Report Details" button
                logRow.addComponents(
                    new ButtonBuilder()
                        .setLabel('Report Details')
                        .setStyle(ButtonStyle.Primary)
                        .setCustomId(`report_details_${ticketCounter}`)
                        .setEmoji('<a:attention:1298284499829784596>') // Using your specified animated emoji
                );
            } else if (ticketType === 'Partnership') {
                // Add "Partnership Details" button
                logRow.addComponents(
                    new ButtonBuilder()
                        .setLabel('Partnership Details')
                        .setStyle(ButtonStyle.Primary)
                        .setCustomId(`partnership_details_${ticketCounter}`)
                        .setEmoji('<a:attention:1298284499829784596>') // Replace with your actual custom emoji
                );
            }

            // Determine the appropriate logs channel based on ticket type
            let logsChannelId;
            if (ticketType === 'Staff Report' || ticketType === 'Partnership') {
                logsChannelId = config.ticketLogsChannelId2;
            } else {
                logsChannelId = config.ticketLogsChannelId1;
            }

            const logsChannel = await guild.channels.fetch(logsChannelId);
            if (!logsChannel) {
                console.error(`Logs channel with ID ${logsChannelId} not found.`);
                return await interaction.followUp({ content: 'Failed to locate the logs channel.', ephemeral: true });
            }

            await logsChannel.send({ embeds: [logEmbed], components: [logRow] });
            console.log('Log embed sent to the logs channel.');

            // Build the embed for the user (DM) with only the "View Transcript" button
            const userLogEmbed = new EmbedBuilder(logEmbed.data); // Clone the logEmbed
            // Optionally, you can customize the embed further for the user

            // Prepare buttons for user DM
            const userRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('View Transcript')
                    .setStyle(ButtonStyle.Link)
                    .setURL(transcriptUrl)
            );

            // Send the embed to the ticket creator (DM)
            if (ticketCreator) {
                await ticketCreator.send({ embeds: [userLogEmbed], components: [userRow] }).catch(console.error);
                console.log(`Log embed sent to user DM: ${ticketCreator.user.tag}`);
            }

            // Remove the exported chat log file after uploading
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) {
                    console.error('Error deleting the exported chat log file:', unlinkErr);
                } else {
                    console.log('Exported chat log file deleted:', filePath);
                }
            });

            // Send a confirmation message before deleting the channel
            await interaction.followUp({ content: 'Ticket successfully deleted.', ephemeral: true });

            // Delete the ticket channel
            await channel.delete();
            console.log(`Ticket channel ${channel.name} deleted.`);
        });
    } catch (error) {
        console.error('Error deleting the ticket:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Failed to delete the ticket.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Failed to delete the ticket.', ephemeral: true });
        }
    }
}

   
  
  
  async function handleReopenTicket(interaction) {
    try {
      const member = interaction.member;
      const user = interaction.user;
      const channel = interaction.channel;
  
      if (!member.roles.cache.has(config.staffRoleId)) {
        return interaction.reply({
          embeds: [generateErrorEmbed(`Only <@&${config.staffRoleId}> can use this command.`)],
          ephemeral: true,
        });
      }
  
      // Fetch the ticket data from the database
      const [ticketRows] = await pool.execute('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
      if (ticketRows.length === 0) {
        return interaction.reply({ content: 'Ticket not found in the database.', ephemeral: true });
      }
      const ticketData = ticketRows[0];
      const parentCategoryId = getCategoryId(ticketData.ticket_type);
  
      // Add the user back to the channel permissions
      await channel.permissionOverwrites.edit(ticketData.user_id, {
        ViewChannel: true,
        SendMessages: true,
      });
  
      await channel.setParent(parentCategoryId, { lockPermissions: false });
  
      // Update ticket status in the database
      await pool.execute('UPDATE tickets SET status = ? WHERE channel_id = ?', ['open', channel.id]);
  
      // Enable the "Close" and "Claim" buttons in the ticket instruction message
      const ticketMessageId = ticketData.ticket_message_id;
      if (ticketMessageId) {
        const ticketMessage = await channel.messages.fetch(ticketMessageId);
        if (ticketMessage) {
          const updatedComponents = ticketMessage.components[0].components.map((button) => {
            if (button.customId === 'close_ticket' || button.customId === 'claim_ticket') {
              return ButtonBuilder.from(button).setDisabled(false);
            }
            return button;
          });
  
          const updatedRow = new ActionRowBuilder().addComponents(updatedComponents);
          await ticketMessage.edit({ components: [updatedRow] });
        }
      }
  
      // Disable the "Delete" and "Reopen" buttons in the current interaction's message
      if (interaction.message && interaction.message.components.length > 0) {
        const updatedComponents = interaction.message.components[0].components.map((button) => {
          if (button.customId === 'delete_ticket' || button.customId === 'reopen_ticket') {
            return ButtonBuilder.from(button).setDisabled(true);
          }
          return button;
        });
  
        const updatedRow = new ActionRowBuilder().addComponents(updatedComponents);
        await interaction.update({ components: [updatedRow] });
      }
  
      // Send a visible confirmation message indicating the ticket has been reopened
      const reopenEmbed = new EmbedBuilder()
        .setColor(0x39ff14)
        .setDescription(`Ticket reopened by <@${user.id}>`);
  
      await channel.send({ embeds: [reopenEmbed] });
    } catch (error) {
      console.error('Error reopening the ticket:', error);
  
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'Failed to reopen the ticket.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Failed to reopen the ticket.', ephemeral: true });
      }
    }
  }
  
  function generateErrorEmbed(message) {
    return new EmbedBuilder().setColor(0xff0000).setDescription(message);
  }
  
async function promptReason(client, interaction, action) {
  if (interaction.isButton()) {
      const modal = new ModalBuilder().setCustomId(`reason_${action}`).setTitle('Reason for Action');

      const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Please provide a reason:')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

      const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
      modal.addComponents(firstActionRow);

      try {
          // Only show the modal if the interaction hasn't already been replied to or deferred
          if (!interaction.replied && !interaction.deferred) {
              await interaction.showModal(modal);
          } else {
              // Handle the situation when the interaction is already replied to or deferred
              console.warn('Interaction already replied or deferred, cannot show modal.');
              await interaction.followUp({
                  content: 'Interaction was already processed. Cannot show modal.',
                  ephemeral: true,
              });
          }
      } catch (error) {
          console.error('Error showing modal:', error);
          if (interaction.replied || interaction.deferred) {
              await interaction
                  .followUp({ content: 'Failed to show the modal.', ephemeral: true })
                  .catch(console.error);
          } else {
              await interaction.reply({ content: 'Failed to show the modal.', ephemeral: true }).catch(console.error);
          }
      }
  }
}

async function handleAddCommand(interaction) {
  const staffRoleId = config.staffRoleId;
  const user = interaction.options.getUser('user', true);
  const channel = interaction.channel;

  // Check if the user issuing the command has the staff role
  if (!interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.reply({ 
          content: `Only <@&${staffRoleId}> can use this command.`, 
          ephemeral: true 
      });
  }

  // Fetch the member to be added to the channel
  const member = await interaction.guild.members.fetch(user.id);

  // Update the channel permissions to grant the user access
  await channel.permissionOverwrites.create(member, {
      ViewChannel: true,
      SendMessages: true
  });

  // Create an embed message
  const embed = new EmbedBuilder()
      .setColor(0x2e96e6) // Blue color
      .setDescription(`> Granted <@${user.id}> access to <#${channel.id}>.`);

  // Reply with the embed message
  await interaction.reply({ embeds: [embed] });
}

module.exports = { 
  setupTicketSystem, 
  handleInteraction, 
  handleAddCommand, 
  handleCloseTicket, 
  handleClaimTicket, 
  handleClaimCommand,
  handleReportDetails 
};
