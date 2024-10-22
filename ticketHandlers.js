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
        .setColor(0x00ff00)
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
    const ticketNumber = interaction.customId.split('_').pop();
  
    // Fetch the ticket data from the database using ticket_number
    const [ticketRows] = await pool.execute('SELECT * FROM tickets WHERE ticket_number = ?', [ticketNumber]);
    if (ticketRows.length === 0) {
      return interaction.reply({ content: 'Ticket not found.', ephemeral: true });
    }
    const ticketData = ticketRows[0];
  
    // Build the details embed
    const detailsEmbed = new EmbedBuilder()
      .setTitle('Partnership Details')
      .setDescription(
        `**Server Invite:** ${ticketData.invite_link}\n` +
        `**Reason:**\n> ${ticketData.reason.replace(/\n/g, '\n> ')}`
      )
      .setColor(0x00ff00)
      .setTimestamp();
  
    await interaction.reply({ embeds: [detailsEmbed], ephemeral: true });
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
  
  function isValidUrl(url) {
    const regex = /^(https?:\/\/[^\s]+)/g;
    return regex.test(url);
  }
  
  async function validateDiscordInvite(client, inviteLink) {
    try {
      const invite = await client.fetchInvite(inviteLink);
      return !!invite;
    } catch (error) {
      return false;
    }
  }
  
  async function handleModalSubmission(interaction, ticketTypeKey) {
    const ticketType = ticketTypeKey
      .replace('_', ' ')
      .replace('modal_', '')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  
    const data = {};
    const fields = interaction.fields;
  
    // Check if the ticket type is 'Report' or 'Staff Report'
    if (ticketType === 'Report' || ticketType === 'Staff Report') {
      const reportedUserInput = fields.getTextInputValue('reported_user');
      const reason = fields.getTextInputValue('reason');
      const proof = fields.getTextInputValue('proof');
  
      // Validate and process the proof URLs
      const proofUrls = proof.split(/\s+/).filter((url) => url.startsWith('http'));
  
      // Attempt to find the reported user in the guild
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
  
      // Save the reported user ID and mention
      data.reportedUserId = reportedMember.id;
      data.reportedUserMention = `<@${reportedMember.id}>`;
  
      data.reason = reason;
      data.proofUrls = proofUrls;
  
      // Proceed to create the ticket channel with collected data
      await createTicketChannel(interaction, ticketType, data);
    } else if (ticketType === 'Partnership') {
      // Handle partnership ticket data
      const inviteLink = fields.getTextInputValue('invite_link');
      const reason = fields.getTextInputValue('reason');
  
      data.inviteLink = inviteLink;
      data.reason = reason;
  
      // Proceed to create the ticket channel with collected data
      await createTicketChannel(interaction, ticketType, data);
    }
  }
  
  
  
  function getPermissionOverwrites(guild, userId, ticketType) {
    const overwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: userId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      },
    ];
  
    if (['General', 'Appeal', 'Report'].includes(ticketType)) {
      overwrites.push({
        id: config.staffRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    } else if (['Staff Report', 'Partnership'].includes(ticketType)) {
      overwrites.push({
        id: config.adminRoleId, // Ensure this is set in config.js
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    }
  
    return overwrites;
  }
  
  async function createTicketChannel(interaction, ticketType, data) {
    const { guild, user } = interaction;
    await interaction.deferReply({ ephemeral: true });
  
    try {
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
  
      let ticketInfoEmbed;
      const row = new ActionRowBuilder();
  
      if (ticketType === 'Report' || ticketType === 'Staff Report') {
        ticketInfoEmbed = new EmbedBuilder()
          .setColor(0x05D9FF) // Updated color
          .setAuthor({ name: `${ticketType} Ticket`, iconURL: guild.iconURL({ dynamic: true }) })
          .setTitle('Ticket Details')
          .setDescription(
            `**Issued by:** <@${user.id}>\n` + // Added "Issued by:"
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
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`evidence_${ticketCounter}`)
            .setLabel('Evidence')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📁')
        );
  
        // Save the proof URLs in the database
        await pool.execute(
          'INSERT INTO tickets (user_id, channel_id, ticket_number, ticket_type, reported_user, reason, proof_urls) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            user.id,
            ticketChannel.id,
            ticketCounter,
            ticketType,
            data.reportedUserMention, // Correctly referenced
            data.reason,
            JSON.stringify(data.proofUrls),
          ]
        );
      } else if (ticketType === 'Partnership') {
        // Prepare the ticket info embed
        ticketInfoEmbed = new EmbedBuilder()
          .setColor(0x05D9FF) // Updated color for consistency
          .setAuthor({ name: `${ticketType} Ticket`, iconURL: guild.iconURL({ dynamic: true }) })
          .setTitle('Ticket Details')
          .setDescription(
            `**Issued by:** <@${user.id}>\n` + // Added "Issued by:"
            `**Server Invite:** ${data.inviteLink}\n` +
            `**Reason for partnership:**\n> ${data.reason.replace(/\n/g, '\n> ')}\n` +
            '```\nPlease wait patiently while we evaluate the partnership. In the meantime, if you have anything else to say do so now. Please refrain from pinging staff. Thanks!\n```'
          )
          .setFooter({ text: 'Pika Ranked Bedwars Tickets!' })
          .setTimestamp();
  
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
        );
  
        // Save the partnership data in the database
        await pool.execute(
          'INSERT INTO tickets (user_id, channel_id, ticket_number, ticket_type, invite_link, reason) VALUES (?, ?, ?, ?, ?, ?)',
          [user.id, ticketChannel.id, ticketCounter, ticketType, data.inviteLink, data.reason]
        );
      } else {
        // For General and Appeal tickets
        ticketInfoEmbed = new EmbedBuilder()
          .setColor(0x05D9FF) // Updated color
          .setAuthor({ name: `${ticketType} Ticket`, iconURL: guild.iconURL({ dynamic: true }) })
          .setTitle('Ticket Instructions')
          .setDescription('```Please wait patiently for staff to reply. In the meantime, please provide details about your issue. If no one replies, please refrain from mentioning staff. Thanks!```')
          .setFooter({ text: 'Pika Ranked Bedwars Tickets!' });
  
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
  
        // Save the ticket data in the database
        await pool.execute(
          'INSERT INTO tickets (user_id, channel_id, ticket_number, ticket_type) VALUES (?, ?, ?, ?)',
          [user.id, ticketChannel.id, ticketCounter, ticketType]
        );
      }
  
      // Send welcome message as an embed
      const welcomeEmbed = new EmbedBuilder()
        .setColor(0x05D9FF) // Consistent color
        .setDescription(`Hey <@${user.id}> 👋!\nPlease wait patiently!`);
  
      await ticketChannel.send({ embeds: [welcomeEmbed] });
      const ticketMessage = await ticketChannel.send({ embeds: [ticketInfoEmbed], components: [row] });
  
      // Update ticket with ticket message ID
      await pool.execute('UPDATE tickets SET ticket_message_id = ? WHERE channel_id = ?', [
        ticketMessage.id,
        ticketChannel.id,
      ]);
  
      // Increment the ticket counter in the database
      ticketCounter++;
      await pool.execute('UPDATE ticket_settings SET ticket_counter = ? WHERE id = 1', [ticketCounter]);
  
      const confirmationEmbed = new EmbedBuilder()
        .setColor(0x00008B)
        .setDescription(
          `**Your ticket has been opened.**\n⤿ Head over to <#${ticketChannel.id}> to discuss your issue with the staff.`
        );
  
      await interaction.editReply({ embeds: [confirmationEmbed] });
    } catch (error) {
      console.error('Failed to create a ticket channel:', error);
      await interaction.followUp({
        content: 'There was an error creating your ticket. Please try again later.',
        ephemeral: true,
      });
    }
  }
  
  
  async function sendProofMessages(channel, proofUrls) {
    for (const url of proofUrls) {
      try {
        const embed = new EmbedBuilder().setTitle('Evidence').setImage(url);
        await channel.send({ embeds: [embed] });
      } catch (error) {
        console.error('Error sending proof message:', error);
        // If cannot send as embed, send the URL directly
        await channel.send(`Proof URL: ${url}`);
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

        const permissionOverwrites = [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            },
            {
                id: config.staffRoleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            },
        ];
        const parentCategoryId = getCategoryId(ticketType);

        // Create the ticket channel and get the channel object directly
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
            `**Ticket Claimed ➤** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
            `**Claimed by ➤** <@${user.id}>\n` +
            `**Reason ➤** \`${reason}\``
          );
  
        // Prepare buttons including "View Evidence" and "Report Details" if applicable
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('View Transcript')
            .setStyle(ButtonStyle.Link)
            .setURL(transcriptUrl)
        );
  
        if (ticketType === 'Report' || ticketType === 'Staff Report') {
          if (ticketData.proof_urls) {
            row.addComponents(
              new ButtonBuilder()
                .setLabel('View Evidence')
                .setStyle(ButtonStyle.Primary)
                .setCustomId(`evidence_${ticketCounter}`) // Including ticket ID
                .setEmoji('📁')
            );
          }
  
          // Add "Report Details" button
          row.addComponents(
            new ButtonBuilder()
              .setLabel('Report Details')
              .setStyle(ButtonStyle.Primary)
              .setCustomId(`report_details_${ticketCounter}`) // Including ticket ID
              .setEmoji('<a:attention:1298284499829784596>') // Animated emoji
          );
        }
  
        // Send the embed to the appropriate logs channel
        const logsChannelId =
          ['General', 'Appeal', 'Report'].includes(ticketType)
            ? config.ticketLogsChannelId1
            : config.ticketLogsChannelId2;
        const logsChannel = await guild.channels.fetch(logsChannelId);
        await logsChannel.send({ embeds: [logEmbed], components: [row] });
  
        // Send the embed to the ticket creator
        if (ticketCreator) {
          await ticketCreator.send({ embeds: [logEmbed], components: [row] }).catch(console.error);
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
      const guild = interaction.guild; // Ensure guild is available
  
      // Fetch the ticket data from the database
      const [ticketRows] = await pool.execute('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
      if (ticketRows.length === 0) {
        return interaction.reply({ content: 'Ticket not found in the database.', ephemeral: true });
      }
      const ticketData = ticketRows[0];
  
      // Extract necessary data
      const ticketNumber = ticketData.ticket_number;
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
            `**Ticket Deleted ➤** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
            `**Deleted by ➤** <@${user.id}>\n` +
            `**Reason ➤** \`${reason}\``
          );
  
        // Prepare buttons including "View Evidence" and "Report Details" if applicable
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('View Transcript')
            .setStyle(ButtonStyle.Link)
            .setURL(transcriptUrl)
        );
  
        if (ticketType === 'Report' || ticketType === 'Staff Report') {
          if (ticketData.proof_urls) {
            row.addComponents(
              new ButtonBuilder()
                .setLabel('View Evidence')
                .setStyle(ButtonStyle.Primary)
                .setCustomId(`evidence_${ticketCounter}`) // Including ticket ID
                .setEmoji('📁')
            );
          }
  
          // Add "Report Details" button
          row.addComponents(
            new ButtonBuilder()
              .setLabel('Report Details')
              .setStyle(ButtonStyle.Primary)
              .setCustomId(`report_details_${ticketCounter}`) // Including ticket ID
              .setEmoji('<a:attention:1298284499829784596>') // Animated emoji
          );
        }
  
        // Send the embed to the appropriate logs channel
        const logsChannelId =
          ['General', 'Appeal', 'Report'].includes(ticketType)
            ? config.ticketLogsChannelId1
            : config.ticketLogsChannelId2;
        const logsChannel = await guild.channels.fetch(logsChannelId);
        await logsChannel.send({ embeds: [logEmbed], components: [row] });
  
        // Send the embed to the ticket creator
        if (ticketCreator) {
          await ticketCreator.send({ embeds: [logEmbed], components: [row] }).catch(console.error);
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
