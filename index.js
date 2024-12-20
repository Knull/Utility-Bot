const { Client, GatewayIntentBits, Events, SlashCommandBuilder, PermissionsBitField, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, Partials, Collection  } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { EventEmitter } = require('events');
EventEmitter.defaultMaxListeners = 45;
const { Routes } = require('discord-api-types/v10');
const config = require('./config');
const { setupTicketSystem, handleInteraction, handleAddCommand, handleCloseTicket, handleClaimTicket, handleClaimCommand, handleRemoveCommand } = require('./ticketHandlers.js');
const { JSDOM } = require('jsdom');
const axios = require('axios');
const boosterHandler = require('./booster.js');

const mysql = require('mysql2/promise');
const pool = mysql.createPool({
    host: '216.225.202.122',
    user: 'user_phpmyadmin',
    password: 'SepHup9ePRap@lch2tRO',
    database: 'PRBW',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [
        Partials.Message, 
        Partials.Channel, 
        Partials.Reaction,
        Partials.GuildMember
    ]
});

const rest = new REST({ version: '10' }).setToken(config.token);
client.pool = pool;

const commands = [
    {
        name: 'join',
        description: 'Announce a user joining the staff team.',
        options: [
            {
                name: 'user',
                description: 'User joining the staff team.',
                type: 6, // USER type
                required: true,
            },
            {
                name: 'role',
                description: 'Role the user is joining as.',
                type: 8, // ROLE type
                required: true,
            },
        ],
    },
    {
        name: 'departure',
        description: 'Announce the departure of a staff member.',
        options: [
            {
                name: 'user',
                description: 'User who is departing.',
                type: 6, // USER type
                required: true,
            },
            {
                name: 'role',
                description: 'Role the user is departing from.',
                type: 8, // ROLE type
                required: true,
            },
        ],
    },
    {
        name: 'return',
        description: 'Announce the return of a staff member.',
        options: [
            {
                name: 'user',
                description: 'User who is returning.',
                type: 6, // USER type
                required: true,
            },
            {
                name: 'role',
                description: 'Role the user is returning to.',
                type: 8, // ROLE type
                required: true,
            },
        ],
    },
    {
        name: 'promote',
        description: 'Announce the promotion of a staff member.',
        options: [
            {
                name: 'user',
                description: 'User who is being promoted.',
                type: 6, // USER type
                required: true,
            },
            {
                name: 'role',
                description: 'Role the user is being promoted to.',
                type: 8, // ROLE type
                required: true,
            },
        ],
    },
    {
        name: 'lock',
        description: 'Lock the current ticket channel to Manager+ roles.',
        options: [], // No options needed
    },
    {
        name: 'unlock',
        description: 'Unlock the current ticket channel and restore original permissions.',
        options: [], // No options needed
    },
    {
        name: 'translation_blacklist',
        description: 'Blacklist a user for a set duration',
        options: [
            {
                name: 'user',
                description: 'The user to blacklist',
                type: 6, // USER type
                required: true,
            },
            {
                name: 'duration',
                description: 'Duration for the blacklist (e.g., "10m", "1h", "1d")',
                type: 3, // STRING type
                required: true,
            },
            {
                name: 'reason',
                description: 'Reason for blacklisting the user',
                type: 3, // STRING type
                required: false,
            },
        ],
    },
    {
        name: 'translation_unblacklist',
        description: 'Unblacklist a user manually',
        options: [
            {
                name: 'user',
                description: 'The user to unblacklist',
                type: 6, // USER type
                required: true,
            },
        ],
    },
    {
        name: 'upgrade',
        description: 'Promote a user to a specific tier',
        options: [
            {
                name: 'user',
                description: 'The user to promote',
                type: 6, // USER type
                required: true,
            },
            {
                name: 'tier',
                description: 'The tier to promote the user to',
                type: 3, // STRING type
                required: true,
                autocomplete: true,
            },
        ],
    },
    
   
    {
        name: 'premium',
        description: 'Manage Premium roles',
        options: [
            {
                name: 'add',
                description: 'Add Premium role to a user',
                type: 1, // Subcommand
                options: [
                    {
                        name: 'user',
                        description: 'User to add Premium role to',
                        type: 6, // USER type
                        required: true,
                    },
                ],
            },
            {
                name: 'remove',
                description: 'Remove Premium role from a user',
                type: 1, // Subcommand
                options: [
                    {
                        name: 'user',
                        description: 'User to remove Premium role from',
                        type: 6, // USER type
                        required: true,
                    },
                ],
            },
            {
                name: 'list',
                description: 'List all users with the Premium role',
                type: 1, // Subcommand
                options: [], // No additional options
            },
        ],
    },
    {
        name: 'close',
        description: 'Close a ticket',
        type: 1, // Subcommand
        options: []
    },
    {
        name: 'claim',
        description: 'Claim a ticket',
        type: 1, // Subcommand
        options: [
            {
                name: 'reason',
                description: 'Reason for claiming the ticket',
                type: 3, // STRING type
                required: true
            }
        ]
    },
    {
        name: 'pugs',
        description: 'PUGs commands',
        options: [
            {
                name: 'vote',
                description: 'Vote for PUGs',
                type: 1, // Subcommand
                options: [
                    {
                        name: 'user',
                        description: 'User to vote for',
                        type: 6, // USER type
                        required: true
                    }
                ]
            },
            {
                name: 'myvote',
                description: 'Show your vote results',
                type: 1 // Subcommand
            },
            {
                name: 'add',
                description: 'Add PUGs role to a user',
                type: 1, // Subcommand
                options: [
                    {
                        name: 'user',
                        description: 'User to add role to',
                        type: 6, // USER type
                        required: true
                    },
                    {
                        name: 'type',
                        description: 'Type of PUGs role (trial or pugs)',
                        type: 3, // STRING type
                        required: true,
                        choices: [
                            {
                                name: 'PUGs Trial',
                                value: 'trial'
                            },
                            {
                                name: 'PUGs',
                                value: 'pugs'
                            }
                        ]
                    }
                ]
            },
            {
                name: 'remove',
                description: 'Remove PUGs role from a user',
                type: 1, // Subcommand
                options: [
                    {
                        name: 'user',
                        description: 'User to remove role from',
                        type: 6, // USER type
                        required: true
                    }
                    
                ]
            },
            {
                name: 'list',
                description: 'List all users with PUGs role',
                type: 1 // Subcommand
            }
        ]
    },
    
    {
        name: 'pups',
        description: 'PUPS commands',
        options: [
            {
                name: 'vote',
                description: 'Vote for PUPS',
                type: 1, // Subcommand
                options: [
                    {
                        name: 'user',
                        description: 'User to vote for',
                        type: 6, // USER type
                        required: true
                    }
                ]
            },
            {
                name: 'myvote',
                description: 'Show your vote results',
                type: 1 // Subcommand
            },
            {
                name: 'add',
                description: 'Add PUPS role to a user',
                type: 1, // Subcommand
                options: [
                    {
                        name: 'user',
                        description: 'User to add role to',
                        type: 6, // USER type
                        required: true
                    }
                ]
            },
            {
                name: 'remove',
                description: 'Remove PUPS role from a user',
                type: 1, // Subcommand
                options: [
                    {
                        name: 'user',
                        description: 'User to remove role from',
                        type: 6, // USER type
                        required: true
                    }
                ]
            },
            {
                name: 'list',
                description: 'List all users with PUPS role',
                type: 1 // Subcommand
            }
        ]
    },
    {
        name: 'add',
        description: 'Add a user or role to a ticket',
        options: [
            {
                name: 'mentionable',
                description: 'The user or role to add to the ticket',
                type: 9, // MENTIONABLE type
                required: true,
            },
        ],
    },
    {
        name: 'remove',
        description: 'Remove a user or role from a ticket',
        options: [
            {
                name: 'mentionable',
                description: 'The user or role to remove from the ticket',
                type: 9, // MENTIONABLE type
                required: true,
            },
        ],
    },
    
    {
        name: 'staff-list',
        description: 'Displays a paginated list of staff members',
        options: [
            {
                name: 'sort-by',
                description: 'Sort staff list by hierarchy level',
                type: 3, // STRING type
                required: false,
                choices: [
                    { name: 'Owner', value: 'owner' },
                    { name: 'Head Developer', value: 'head-developer' },
                    { name: 'Manager', value: 'manager' },
                    { name: 'Developer', value: 'developer' },
                    { name: 'Designer', value: 'designer' },
                    { name: 'Admin', value: 'admin' },
                    { name: 'Mod', value: 'mod' },
                    { name: 'Helper', value: 'helper' },
                ],
            },
            {
                name: 'order',
                description: 'Order of the list',
                type: 3, // STRING type
                required: false,
                choices: [
                    { name: 'Ascending', value: 'ascending' },
                    { name: 'Descending', value: 'descending' },
                ],
            },
        ],
    },
    
];

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.once('ready', async () => {
    console.log('Bot is ready!');
    await setupTicketSystem(client);
    
    


    // Fetch the guild
    const guildId = '1228653980780072981'; // Replace with your server's ID
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
        console.error(`Guild with ID ${guildId} not found. Ensure the bot is a member of the guild and has the necessary permissions.`);
        return;
    }

    // Additional logging to confirm guild details
    console.log(`Fetched guild: ${guild.name} (ID: ${guild.id})`);

    // Check for expired rank bans and mutes on startup
    
});

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isCommand()) {
            const { commandName } = interaction;

            if (commandName === 'add') {
                await handleAddCommand(interaction);
            } else if (commandName === 'remove') {
                await handleRemoveCommand(interaction);
            } else if (commandName === 'close') {
                await handleCloseTicket(interaction);
            } else if (commandName === 'claim') {
                const reason = interaction.options.getString('reason', true);
                await handleClaimCommand(interaction, reason);
            }
        } else {
            // For non-command interactions, call handleInteraction
            await handleInteraction(client, interaction);
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
    }
});




client.login(config.token);
const ownerId = '1155078877803192420';
boosterHandler(client);

async function sendErrorLog(error) {
    try {
        const user = await client.users.fetch(ownerId);
        
        const errorEmbed = new EmbedBuilder()
            .setColor(0x8B0000) // Dark red color
            .setDescription(`\`\`\`js\n${error.stack || error}\n\`\`\``)
            .setTimestamp(); // Adds a timestamp to the embed

        await user.send({ embeds: [errorEmbed] });
    } catch (err) {
        // If DM fails, no additional action is taken
    }
}
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (!interaction.guild) {
        return interaction.reply({
            content: 'This command can only be used within a server.',
            ephemeral: true,
        });
    }

    const commandName = interaction.commandName;
    const restrictedCommands = ['departure', 'return', 'promote', 'join'];

    if (restrictedCommands.includes(commandName)) {
        const allowedRoleIds = [
            config.AdminRoleId,
            config.ManagerRoleId,
            config.HeadDeveloperRoleId,
            config.OwnerRoleId,
        ];

        const member = interaction.member;
        const hasPermission = member.roles.cache.some((role) =>
            allowedRoleIds.includes(role.id)
        );

        if (!hasPermission) {
            const roleMentions = allowedRoleIds
                .map((roleId) => `<@&${roleId}>`)
                .join('\n');

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Insufficient Permissions')
                .setDescription(
                    `Only members with these roles can use this command:\n${roleMentions}`
                )
                .setFooter({
                    text: interaction.guild.name,
                    iconURL: interaction.guild.iconURL(),
                })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const announcementChannel = interaction.guild.channels.cache.get(
            config.announcementChannelId
        );
        if (!announcementChannel) {
            return interaction.editReply({
                content: 'Announcement channel not found.',
                ephemeral: true,
            });
        }

        const userOption = interaction.options.getUser('user');
        const roleOption = interaction.options.getRole('role');

        const user = await interaction.guild.members
            .fetch(userOption.id)
            .catch(() => null);
        if (!user) {
            return interaction.editReply({
                content: 'User not found in this server.',
                ephemeral: true,
            });
        }

        const role = interaction.guild.roles.cache.get(roleOption.id);
        if (!role) {
            return interaction.editReply({
                content: 'Role not found in this server.',
                ephemeral: true,
            });
        }

        const embed = new EmbedBuilder()
            .setFooter({
                text: interaction.guild.name,
                iconURL: interaction.guild.iconURL(),
            })
            .setTimestamp()
            .setColor(role.color || 0x00ae86);

        const roleIconURL = role.iconURL();

        // Set the embed title and description dynamically based on the command
        if (commandName === 'join') {
            embed.setAuthor({
                name: `New ${role.name}!`,
                iconURL: roleIconURL,
            });
            embed.setDescription(`- ${user} has joined the staff team as a **<@&${role.id}>**`);
        } else if (commandName === 'departure') {
            embed.setAuthor({
                name: `${role.name} Departure`,
                iconURL: roleIconURL,
            });
            embed.setDescription(`- ${user} is no longer a **<@&${role.id}>**`);
        } else if (commandName === 'return') {
            embed.setAuthor({
                name: `${role.name} Return`,
                iconURL: roleIconURL,
            });
            embed.setDescription(`- ${user} has returned to our staff team as a **<@&${role.id}>**`);
        } else if (commandName === 'promote') {
            embed.setAuthor({
                name: `${role.name} Promotion`,
                iconURL: roleIconURL,
            });
            embed.setDescription(`- ${user} has been promoted to **<@&${role.id}>**`);
        }

        await announcementChannel.send({ embeds: [embed] });

        await interaction.editReply({
            content: `${capitalizeFirstLetter(commandName)} announcement sent.`,
            ephemeral: true,
        });
    }
});



// Utility function to capitalize the first letter
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
// Catch uncaught exceptions
process.on("uncaughtException", sendErrorLog);

// Catch unhandled promise rejections
process.on("unhandledRejection", sendErrorLog);
const staffRoles = [
    config.OwnerRoleId,
    config.HeadDeveloperRoleId,
    config.ManagerRoleId,
    config.DeveloperRoleId,
    config.DesignerRoleId,
    config.AdminRoleId,
    config.ModRoleId,
    config.HelperRoleId,
];
client.pagination = new Collection();

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isCommand()) {
            if (interaction.commandName === 'staff-list') {
                await handleStaffListCommand(interaction);
            } else {
                // Handle other commands
            }
        } else if (interaction.isButton()) {
            if (interaction.customId.startsWith('stafflist_')) {
                await handlePagination(interaction);
            } else {
                // Handle other button interactions
            }
        }
    } catch (error) {
        console.error(`Error handling interaction: ${error.message}`);

        // Respond to the interaction if possible
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: 'An error occurred while processing your interaction.',
                ephemeral: true,
            });
        } else if (interaction.isRepliable()) {
            await interaction.reply({
                content: 'An error occurred while processing your interaction.',
                ephemeral: true,
            });
        }
    }
});


client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isCommand()) {

            if (interaction.commandName === 'lock') {
                // Existing lock command handler
                const lockCommandHandler = async () => {
                    // Ensure the command is used in a guild
                    if (!interaction.guild) {
                        return interaction.reply({ content: 'This command can only be used within a server.', ephemeral: true });
                    }

                    // Defer the reply to prevent the interaction from expiring
                    await interaction.deferReply({ ephemeral: false });

                    // Define roles that can use the command
                    const allowedRoleIds = [
                        config.ManagerRoleId,
                        config.HeadDeveloperRoleId,
                        config.OwnerRoleId,
                    ];

                    // Check if the user has one of the allowed roles
                    const member = interaction.member;
                    const hasPermission = member.roles.cache.some(role => allowedRoleIds.includes(role.id));

                    if (!hasPermission) {
                        // Fetch role mentions
                        const roleMentions = allowedRoleIds.map(roleId => `<@&${roleId}>`).join('\n');

                        // Create an embed to inform the user
                        const embed = new EmbedBuilder()
                            .setColor('#FF0000') // Red color for error
                            .setTitle('Insufficient Permissions')
                            .setDescription(`Only members with the following roles can use this command:\n${roleMentions}`)
                            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                            .setTimestamp();

                        return interaction.editReply({ embeds: [embed], ephemeral: true });
                    }

                    const channel = interaction.channel;

                    // Check if the channel is a ticket channel by querying the database
                    try {
                        console.log(`Channel ID from bot: ${channel.id} (Length: ${channel.id.length})`);
                        const [rows] = await client.pool.query('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
                        console.log(`Number of rows returned: ${rows.length}`);
                        console.log('Rows:', rows);

                        if (rows.length === 0) {
                            return interaction.editReply({ content: 'This command can only be used in ticket channels.' });
                        }

                        const ticket = rows[0];

                        // Determine if the ticket is closed
                        const isClosed = ticket.status === 'closed' || ticket.status === 'deleted';

                        // Fetch the ticket owner
                        const ticketOwnerId = ticket.user_id;
                        const ticketOwner = await interaction.guild.members.fetch(ticketOwnerId).catch(() => null);

                        // Define roles that should have access
                        const managerRoles = [
                            config.ManagerRoleId,
                            config.HeadDeveloperRoleId,
                            config.OwnerRoleId,
                        ];

                        // Create permission overwrites
                        const permissionOverwrites = [
                            {
                                id: interaction.guild.roles.everyone.id, // Deny @everyone
                                deny: [PermissionsBitField.Flags.ViewChannel],
                            },
                            // Allow Manager+ roles
                            ...managerRoles.map(roleId => ({
                                id: roleId,
                                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                            })),
                        ];

                        // If the ticket is not closed and the owner exists, allow the owner to view and send messages
                        if (!isClosed && ticketOwner) {
                            permissionOverwrites.push({
                                id: ticketOwnerId,
                                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                            });
                        }

                        // Update channel permissions
                        await channel.permissionOverwrites.set(permissionOverwrites, 'Channel locked by Manager');

                        // Create the embed with desired color and content
                        const embed = new EmbedBuilder()
                            .setColor('#1E90FF') // Dodger Blue (neon light blue)
                            .setTitle('🔒 Channel Locked')
                            .setDescription(`This channel has been locked to Manager+ roles.${!isClosed && ticketOwner ? `\n> <@${ticketOwnerId}> still has access.` : ''}`)
                            .setFooter({ text: `Locked by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                            .setTimestamp();

                        // Provide feedback to the user via embed
                        return interaction.editReply({
                            embeds: [embed],
                            ephemeral: false, // Set to true if only the command executor should see the message
                        });
                    } catch (error) {
                        console.error(`Error in /lock command: ${error}`);
                        return interaction.editReply({ content: 'There was an error while trying to lock the channel.' });
                    }
                };

                // Execute the lock command handler
                await lockCommandHandler();

            } else if (interaction.commandName === 'unlock') {
                // Separate unlock command handler
                const unlockCommandHandler = async () => {
                    // Ensure the command is used in a guild
                    if (!interaction.guild) {
                        return interaction.reply({ content: 'This command can only be used within a server.', ephemeral: true });
                    }

                    // Defer the reply to prevent the interaction from expiring
                    await interaction.deferReply({ ephemeral: false });

                    // Define roles that can use the command
                    const allowedRoleIds = [
                        config.ManagerRoleId,
                        config.HeadDeveloperRoleId,
                        config.OwnerRoleId,
                    ];

                    // Check if the user has one of the allowed roles
                    const member = interaction.member;
                    const hasPermission = member.roles.cache.some(role => allowedRoleIds.includes(role.id));

                    if (!hasPermission) {
                        // Fetch role mentions
                        const roleMentions = allowedRoleIds.map(roleId => `<@&${roleId}>`).join('\n');

                        // Create an embed to inform the user
                        const embed = new EmbedBuilder()
                            .setColor('#FF0000') // Red color for error
                            .setTitle('Insufficient Permissions')
                            .setDescription(`Only members with the following roles can use this command:\n${roleMentions}`)
                            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                            .setTimestamp();

                        return interaction.editReply({ embeds: [embed], ephemeral: true });
                    }

                    const channel = interaction.channel;

                    // Check if the channel is a ticket channel by querying the database
                    try {
                        console.log(`Channel ID from bot: ${channel.id} (Length: ${channel.id.length})`);
                        const [rows] = await client.pool.query('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
                        console.log(`Number of rows returned: ${rows.length}`);
                        console.log('Rows:', rows);

                        if (rows.length === 0) {
                            return interaction.editReply({ content: 'This command can only be used in ticket channels.' });
                        }

                        const ticket = rows[0];

                        // Fetch the ticket owner
                        const ticketOwnerId = ticket.user_id;
                        const ticketOwner = await interaction.guild.members.fetch(ticketOwnerId).catch(() => null);

                        // Get the ticket type
                        const ticketType = ticket.ticket_type;

                        // Use getPermissionOverwrites to restore permissions
                        const permissionOverwrites = getPermissionOverwrites(interaction.guild, ticketOwnerId, ticketType);

                        // Update channel permissions
                        await channel.permissionOverwrites.set(permissionOverwrites, 'Channel unlocked and permissions restored');

                        // Create the embed with desired color and content
                        const embed = new EmbedBuilder()
                            .setColor('#1E90FF') // Dodger Blue (neon light blue)
                            .setTitle('🔓 Channel Unlocked')
                            .setDescription(`This channel has been unlocked and permissions have been restored.`)
                            .setFooter({ text: `Unlocked by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                            .setTimestamp();

                        // Provide feedback to the user via embed
                        return interaction.editReply({
                            embeds: [embed],
                            ephemeral: false, // Set to true if only the command executor should see the message
                        });
                    } catch (error) {
                        console.error(`Error in /unlock command: ${error}`);
                        return interaction.editReply({ content: 'There was an error while trying to unlock the channel.' });
                    }
                };

                // Execute the unlock command handler
                await unlockCommandHandler();

            } 

        } 

    } catch (error) {
        console.error(`Error handling interaction: ${error.message}`);

        // Respond to the interaction if possible
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: 'An error occurred while processing your interaction.',
                ephemeral: true,
            });
        } else if (interaction.isRepliable()) {
            await interaction.reply({
                content: 'An error occurred while processing your interaction.',
                ephemeral: true,
            });
        }
    }
});
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
// Handler for the 'staff-list' Command
async function handleStaffListCommand(interaction) {
    await interaction.deferReply(); // Defer reply to avoid interaction timeout

    const sortBy = interaction.options.getString('sort-by');
    const order = interaction.options.getString('order') || 'ascending';
    const guild = interaction.guild;

    await guild.members.fetch();

    const allStaffRoles = [
        { name: 'Owner', id: config.OwnerRoleId },
        { name: 'Head Developer', id: config.HeadDeveloperRoleId },
        { name: 'Manager', id: config.ManagerRoleId },
        { name: 'Developer', id: config.DeveloperRoleId },
        { name: 'Designer', id: config.DesignerRoleId },
        { name: 'Admin', id: config.AdminRoleId },
        { name: 'Mod', id: config.ModRoleId },
        { name: 'Helper', id: config.HelperRoleId },
        { name: 'Staff Base Role', id: config.staffRoleId },
    ];

    const selectedRole = allStaffRoles.find(role => role.name.toLowerCase() === sortBy?.toLowerCase());
    const memberList = guild.members.cache.filter(member => {
        if (selectedRole) return member.roles.cache.has(selectedRole.id);
        return member.roles.cache.some(role => allStaffRoles.map(r => r.id).includes(role.id));
    });

    const sortedMembersArray = Array.from(memberList.values()).sort((a, b) => {
        const roleIndexA = allStaffRoles.findIndex(role => a.roles.cache.has(role.id));
        const roleIndexB = allStaffRoles.findIndex(role => b.roles.cache.has(role.id));
        return order === 'ascending' ? roleIndexA - roleIndexB : roleIndexB - roleIndexA;
    });

    const pageSize = 10;
    const totalPages = Math.ceil(sortedMembersArray.length / pageSize);
    let currentPage = 1;
    const embedTitleMode = selectedRole ? selectedRole.name : 'Staff';

    const embed = getPageEmbed(currentPage, sortedMembersArray, guild, interaction, totalPages, embedTitleMode);
    const buttons = getPaginationButtons(currentPage, totalPages, interaction.user.id);
    await interaction.editReply({ embeds: [embed], components: [buttons], fetchReply: true });
}

// Pagination Handler
async function handlePagination(interaction) {
    // Parse the customId to extract prefix, action, userId
    const [prefix, action, userId] = interaction.customId.split('_');

    // Ensure only the user who initiated the command can interact
    if (interaction.user.id !== userId) {
        return interaction.reply({ content: `> Only <@${userId}> can run this command.`, ephemeral: true });
    }

    const guild = interaction.guild;

    // Extract the current page number from the embed's title
    const embed = interaction.message.embeds[0];
    let currentPage = 1;
    let totalPages = 1;
    if (embed && embed.title) {
        const match = embed.title.match(/\[(\d+)\/(\d+)\]/);
        if (match) {
            currentPage = parseInt(match[1]);
            totalPages = parseInt(match[2]);
        }
    }

    // Determine the new page based on the action
    let newPage = currentPage;
    if (action === 'next') {
        newPage = Math.min(currentPage + 1, totalPages);
    } else if (action === 'prev') {
        newPage = Math.max(currentPage - 1, 1);
    }

    // Reconstruct the member list
    const allStaffRoles = [
        { name: 'Owner', id: config.OwnerRoleId },
        { name: 'Head Developer', id: config.HeadDeveloperRoleId },
        { name: 'Manager', id: config.ManagerRoleId },
        { name: 'Developer', id: config.DeveloperRoleId },
        { name: 'Designer', id: config.DesignerRoleId },
        { name: 'Admin', id: config.AdminRoleId },
        { name: 'Mod', id: config.ModRoleId },
        { name: 'Helper', id: config.HelperRoleId },
        { name: 'Staff Base Role', id: config.staffRoleId },
    ];

    await guild.members.fetch();

    // Retrieve sortBy and order if you have a way to retain them; otherwise, use default values
    const sortBy = null; // Replace with actual value if available
    const order = 'ascending'; // Replace with actual value if available

    const selectedRole = allStaffRoles.find(role => role.name.toLowerCase() === sortBy?.toLowerCase());
    const memberList = guild.members.cache.filter(member => {
        if (selectedRole) return member.roles.cache.has(selectedRole.id);
        return member.roles.cache.some(role => allStaffRoles.map(r => r.id).includes(role.id));
    });

    const sortedMembersArray = Array.from(memberList.values()).sort((a, b) => {
        const roleIndexA = allStaffRoles.findIndex(role => a.roles.cache.has(role.id));
        const roleIndexB = allStaffRoles.findIndex(role => b.roles.cache.has(role.id));
        return order === 'ascending' ? roleIndexA - roleIndexB : roleIndexB - roleIndexA;
    });

    const pageSize = 10;
    const totalPagesComputed = Math.ceil(sortedMembersArray.length / pageSize);

    // Update totalPages in case it has changed
    totalPages = totalPagesComputed;

    const embedTitleMode = selectedRole ? selectedRole.name : 'Staff';

    // Create the updated embed and buttons
    const updatedEmbed = getPageEmbed(newPage, sortedMembersArray, guild, interaction, totalPages, embedTitleMode);
    const updatedButtons = getPaginationButtons(newPage, totalPages, userId);

    // Use interaction.update() to update the message
    await interaction.update({ embeds: [updatedEmbed], components: [updatedButtons] });
}

// Function to Create the Embed for a Given Page
function getPageEmbed(page, sortedMembersArray, guild, interaction, totalPages, embedTitleMode) {
    const pageSize = 10;
    const pageStartIndex = (page - 1) * pageSize;
    const pageMembers = sortedMembersArray.slice(pageStartIndex, pageStartIndex + pageSize);

    const embed = new EmbedBuilder()
        .setAuthor({ name: `Staff List`, iconURL: guild.iconURL() })
        .setTitle(`Mode: ${embedTitleMode} [${page}/${totalPages}]`)
        .setDescription(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${pageMembers.map((member, i) => `\`${pageStartIndex + i + 1}.\` <@${member.id}>`).join('\n')}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
        .setFooter({
            text: `${sortedMembersArray.findIndex(m => m.user.id === interaction.user.id) + 1}. ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL()
        });

    return embed;
}
function getPaginationButtons(page, totalPages, userId) {
    const prevButton = new ButtonBuilder()
        .setCustomId(`stafflist_prev_${userId}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️')
        .setDisabled(page === 1);

    const nextButton = new ButtonBuilder()
        .setCustomId(`stafflist_next_${userId}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('➡️')
        .setDisabled(page === totalPages);

    return new ActionRowBuilder().addComponents(prevButton, nextButton);
}
// voting
// pups voting

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'pups') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'vote') {
            const user = options.getUser('user');
            const managerRole = interaction.guild.roles.cache.get(config.pupsManagerRoleId);

            if (!interaction.member.roles.cache.has(managerRole.id) && !interaction.member.roles.cache.has(config.premiumManagerRoleId) && !interaction.member.roles.cache.has(config.pugsManagerRoleId)) {
                const embed = new EmbedBuilder()
                    .setDescription(`Only people with these roles can use this command:\n- <@&${config.premiumManagerRoleId}>\n- <@&${config.pugsManagerRoleId}>\n- <@&${config.pupsManagerRoleId}>`)
                    .setColor(0x980e00);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const [rows] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pups" AND active = 1', [user.id]);
            if (rows.length > 0) {
                const embed = new EmbedBuilder()
                    .setDescription('A poll is already active for this user.')
                    .setColor(0x980e00);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            await pool.execute('INSERT INTO polls (user_id, type, upvotes, downvotes, active) VALUES (?, "pups", 0, 0, 1)', [user.id]);

            const embed = new EmbedBuilder()
                .setAuthor({ name: `${user.username} | PUPS Vote`, iconURL: user.displayAvatarURL() })
                .setDescription(`A vote has been created for <@${user.id}> to join <@&${config.pupsRoleId}>.\n\n**Upvotes 👍**\n\`\`\`0                                            \`\`\`\n**Downvotes 👎**\n\`\`\`0                                            \`\`\``)
                .setFooter({ text: `Created by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setColor('#e96d6d');

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

            const channel = interaction.guild.channels.cache.find(ch => ch.name === 'pups-voting');
            await channel.send({ content: `<@&${config.pupsRoleId}>`, embeds: [embed], components: [buttons] });

            return interaction.reply({ embeds: [new EmbedBuilder().setDescription('Vote created.').setColor(0xe96d6d)], ephemeral: true });
        }

        
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Check for voting-related actions
    if (customId.startsWith('upvote_pups_') || customId.startsWith('downvote_pups_')) {
        const parts = customId.split('_');

        if (parts.length < 3) {
            console.error(`Invalid customId: ${customId}`);
            return;
        }

        const action = parts[0];
        const type = parts[1];
        const targetUserId = parts.slice(2).join('_'); // Join remaining parts to handle any underscores in user IDs

        console.log(`Parsed customId - Action: ${action}, Type: ${type}, UserId: ${targetUserId}`);

        if (type !== 'pups') {
            console.log(`Ignoring non-pups type: ${type}`);
            return; // Ensure this only processes "pups" related buttons
        }

        const [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pups" AND active = 1', [targetUserId]);
        if (polls.length === 0) {
            console.error('No active poll found for the user.');
            return interaction.reply({ content: 'No active poll found for this user.', ephemeral: true });
        }

        const poll = polls[0];
        const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);

        console.log(`User ${interaction.user.id} clicked ${action} on poll for user ${targetUserId}`);

        if (!interaction.member.roles.cache.has(pupsRole.id) && !interaction.member.roles.cache.has(config.pugsRoleId) && !interaction.member.roles.cache.has(config.premiumRoleId)) {
            return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`Only members with the roles below can vote.\n- <@&${config.pupsRoleId}>\n- <@&${config.pugsRoleId}>\n- <@&${config.premiumRoleId}>`).setColor(0x980e00)], ephemeral: true });
        }

        if (interaction.user.id === targetUserId) {
            return interaction.reply({ embeds: [new EmbedBuilder().setDescription('You cannot vote on your own poll.').setColor(0x980e00)], ephemeral: true });
        }

        // Check if the user has voted in the current poll, not any previous polls
        const [alreadyVoted] = await pool.execute('SELECT * FROM votes WHERE user_id = ? AND poll_id = ?', [interaction.user.id, poll.id]);

        if (alreadyVoted.length > 0) {
            console.log(`User ${interaction.user.id} has already voted on poll for user ${targetUserId}`);
            return interaction.reply({ embeds: [new EmbedBuilder().setDescription('You have already voted.').setColor(0x980e00)], ephemeral: true });
        }

        const [userCheck] = await pool.execute('SELECT * FROM users WHERE userID = ?', [interaction.user.id]);
        if (userCheck.length === 0) {
            await pool.execute('INSERT INTO users (userID) VALUES (?)', [interaction.user.id]);
        }

        if (action === 'upvote') {
            await pool.execute('UPDATE polls SET upvotes = upvotes + 1 WHERE id = ?', [poll.id]);
            await pool.execute('INSERT INTO votes (user_id, poll_user_id, poll_id, type, vote) VALUES (?, ?, ?, "pups", "upvote")', [interaction.user.id, targetUserId, poll.id]);
            console.log(`User ${interaction.user.id} upvoted poll for user ${targetUserId}`);
        } else if (action === 'downvote') {
            await pool.execute('UPDATE polls SET downvotes = downvotes + 1 WHERE id = ?', [poll.id]);
            await pool.execute('INSERT INTO votes (user_id, poll_user_id, poll_id, type, vote) VALUES (?, ?, ?, "pups", "downvote")', [interaction.user.id, targetUserId, poll.id]);
            console.log(`User ${interaction.user.id} downvoted poll for user ${targetUserId}`);
        }

        const [updatedPoll] = await pool.execute('SELECT * FROM polls WHERE id = ?', [poll.id]);
        const embed = new EmbedBuilder()
            .setAuthor({ name: `${interaction.message.embeds[0].author.name}`, iconURL: interaction.message.embeds[0].author.iconURL })
            .setDescription(`A vote has been created for <@${targetUserId}> to join <@&${config.pupsRoleId}>.\n\n**Upvotes 👍**\n\`\`\`${updatedPoll[0].upvotes}\`\`\`\n**Downvotes 👎**\n\`\`\`${updatedPoll[0].downvotes}\`\`\``)
            .setColor('#e96d6d')
            .setFooter({ text: `Created by ${interaction.message.embeds[0].footer.text.replace('Created by ', '')}`, iconURL: interaction.message.embeds[0].footer.iconURL });

        try {
            await interaction.update({ embeds: [embed] });
            return interaction.followUp({ embeds: [new EmbedBuilder().setDescription(`${action === 'upvote' ? 'Upvoted' : 'Downvoted'}.`).setColor(0xe96d6d)], ephemeral: true });
        } catch (error) {
            console.error('Error updating interaction:', error);
            return interaction.reply({ content: 'Error updating interaction.', ephemeral: true });
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Check for end_vote action
    if (customId.startsWith('end_vote_pups_')) {
        const parts = customId.split('_');

        if (parts.length < 4) {
            console.error(`Invalid customId: ${customId}`);
            return;
        }

        const action = parts[0] + '_' + parts[1]; // Action is 'end_vote'
        const type = parts[2];
        const targetUserId = parts.slice(3).join('_'); // Join remaining parts to handle any underscores in user IDs

        console.log(`Parsed customId - Action: ${action}, Type: ${type}, UserId: ${targetUserId}`);

        if (type !== 'pups') {
            console.log(`Ignoring non-pups type: ${type}`);
            return; // Ensure this only processes "pups" related buttons
        }

        const [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pups" AND active = 1', [targetUserId]);
        if (polls.length === 0) {
            console.error('No active poll found for the user.');
            return interaction.reply({ content: 'No active poll found for this user.', ephemeral: true });
        }

        const poll = polls[0];
        const managerRole = interaction.guild.roles.cache.get(config.pupsManagerRoleId);

        console.log(`User ${interaction.user.id} clicked end_vote on poll for user ${targetUserId}`);

        if (!interaction.member.roles.cache.has(managerRole.id) && !interaction.member.roles.cache.has(config.premiumManagerRoleId) && !interaction.member.roles.cache.has(config.pugsManagerRoleId)) {
            const embed = new EmbedBuilder()
                .setDescription(`Only people with these roles can use this button:\n - <@&${config.premiumManagerRoleId}>\n- <@&${config.pugsManagerRoleId}>\n- <@&${config.pupsManagerRoleId}>`)
                .setColor(0x980e00);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await pool.execute('UPDATE polls SET active = 0 WHERE id = ?', [poll.id]);

        const upvotes = poll.upvotes;
        const downvotes = poll.downvotes;
        const result = upvotes > downvotes ? 'won' : 'lost';
        const resultColor = upvotes > downvotes ? '#e96d6d' : 0x980e00;

        const disabledButtons = new ActionRowBuilder()
            .addComponents(
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

        try {
            await interaction.message.edit({ components: [disabledButtons] });

            const resultEmbed = new EmbedBuilder()
                .setAuthor({ name: `${interaction.guild.members.cache.get(poll.user_id).user.username} | PUPS Vote`, iconURL: interaction.guild.members.cache.get(poll.user_id).user.displayAvatarURL() })
                .setDescription(`**Upvotes:** \`\`\`${poll.upvotes}                                            \`\`\`\n**Downvotes:** \`\`\`${poll.downvotes}                                            \`\`\`\n<@${poll.user_id}> has ${result} the vote!`)
                .setColor(resultColor)
                .setFooter({ text: `Created by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`add_to_pups_${poll.user_id}`)
                    .setLabel('Add To PUPS')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(result === 'lost')
            );

            await interaction.reply({ embeds: [resultEmbed], components: [buttons], ephemeral: true });
            return interaction.followUp({ embeds: [new EmbedBuilder().setDescription('Vote ended.').setColor(0x5b5bb)], ephemeral: true });
        } catch (error) {
            console.error('Error handling end_vote interaction:', error);
            return interaction.reply({ content: 'Error handling end_vote interaction.', ephemeral: true });
        }
    }
});
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Check for add_to_pups action
    if (customId.startsWith('add_to_pups_')) {
        const parts = customId.split('_');

        if (parts.length < 3) {
            console.error(`Invalid customId: ${customId}`);
            return;
        }

        const action = parts.slice(0, 3).join('_'); // Action is 'add_to_pups'
        const targetUserId = parts.slice(3).join('_'); // Join remaining parts to handle any underscores in user IDs

        console.log(`Parsed customId - Action: ${action}, UserId: ${targetUserId}`);

        const managerRole = interaction.guild.roles.cache.get(config.pupsManagerRoleId);

        if (!interaction.member.roles.cache.has(managerRole.id) && !interaction.member.roles.cache.has(config.premiumManagerRoleId) && !interaction.member.roles.cache.has(config.pugsManagerRoleId)) {
            const embed = new EmbedBuilder()
            .setDescription(`Only people with these roles can use this button:\n - <@&${config.premiumManagerRoleId}>\n- <@&${config.pugsManagerRoleId}>\n- <@&${config.pupsManagerRoleId}>`)
            .setColor(0x980e00);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);
        const [pollResult] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pups" AND active = 0', [targetUserId]);

        if (pollResult.length === 0) {
            console.error('No completed poll found for the user.');
            return interaction.reply({ content: 'No completed poll found for this user.', ephemeral: true });
        }

        const poll = pollResult[0];

        try {
            await interaction.guild.members.cache.get(targetUserId).roles.add(pupsRole);
            console.log(`Added user ${targetUserId} to PUPS`);
            
            // Create the embed for the interaction reply
            const replyEmbed = new EmbedBuilder()
                .setDescription(`Added <@${targetUserId}> to <@&${config.pupsRoleId}>.`)
                .setColor(0xe96d6d);
            
            await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

            // Create the embed for the pups-voting channel
            const user = interaction.guild.members.cache.get(targetUserId).user;
            const votingEmbed = new EmbedBuilder()
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setTitle("PUPS Addition")
                .setDescription(`<@${targetUserId}> has been added to <@&${config.pupsRoleId}>`)
                .addFields(
                    { name: 'Upvotes 👍', value: `\`\`\`${poll.upvotes}\`\`\``, inline: true },
                    { name: 'Downvotes 👎', value: `\`\`\`${poll.downvotes}\`\`\``, inline: true }
                )
                .setFooter({ text: `Added by: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setColor('#e96d6d');

            const votingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pups-voting');
            if (votingChannel) {
                await votingChannel.send({ embeds: [votingEmbed] });
            } else {
                console.error('pups-voting channel not found.');
            }
        } catch (error) {
            console.error('Error handling add_to_pups interaction:', error);
            return interaction.reply({ content: 'Error handling add_to_pups interaction.', ephemeral: true });
        }
    }
});
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || interaction.commandName !== 'pups') return;

    const { commandName, options } = interaction;

    if (commandName === 'pups') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'add') {
            const user = options.getUser('user');
            const managerRole = interaction.guild.roles.cache.get(config.pupsManagerRoleId);

            if (!interaction.member.roles.cache.has(managerRole.id) && !interaction.member.roles.cache.has(config.premiumManagerRoleId) && !interaction.member.roles.cache.has(config.pugsManagerRoleId)) {
                const embed = new EmbedBuilder()
                    .setDescription(`Only people with these roles can use this command:\n- <@&${config.premiumManagerRoleId}>\n- <@&${config.pugsManagerRoleId}>\n- <@&${config.pupsManagerRoleId}>`)
                    .setColor(0x980e00);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const role = interaction.guild.roles.cache.get(config.pupsRoleId);

            try {
                await interaction.guild.members.cache.get(user.id).roles.add(role);
                console.log(`Added PUPS role to ${user.username}`);

                // Create the embed for the interaction reply
                const replyEmbed = new EmbedBuilder()
                    .setDescription(`Added <@${user.id}> to <@&${config.pupsRoleId}>.`)
                    .setColor('#e91e63');

                await interaction.reply({ embeds: [replyEmbed], ephemeral: false });

                // Create the embed for the pups-voting channel
                const author = interaction.user;
                const votingEmbed = new EmbedBuilder()
                    .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                    .setTitle("PUPS Addition")
                    .setDescription(`<@${user.id}> has been added to <@&${config.pupsRoleId}>`)
                    .addFields({ name: 'Added by', value: `${author.username}`, inline: false })
                    .setTimestamp()
                    .setColor('#e91e63');

                const votingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pups-voting');
                if (votingChannel) {
                    await votingChannel.send({ embeds: [votingEmbed] });
                } else {
                    console.error('pups-voting channel not found.');
                }
            } catch (error) {
                console.error('Error adding PUPS role:', error);
                return interaction.reply({ content: 'Error adding PUPS role.', ephemeral: true });
            }
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || interaction.commandName !== 'pups') return;
  
    const { commandName, options } = interaction;
  
    if (commandName === 'pups') {
      const subcommand = options.getSubcommand();
  
      if (subcommand === 'remove') {
        const user = options.getUser('user');
        const managerRole = interaction.guild.roles.cache.get(config.pupsManagerRoleId);
  
        // Check if the member has the right role to use the command
        if (!interaction.member.roles.cache.has(managerRole.id) && 
            !interaction.member.roles.cache.has(config.premiumManagerRoleId) && 
            !interaction.member.roles.cache.has(config.pugsManagerRoleId)) {
          const embed = new EmbedBuilder()
            .setDescription(`Only people with these roles can use this command:\n- <@&${config.premiumManagerRoleId}>\n- <@&${config.pugsManagerRoleId}>\n- <@&${config.pupsManagerRoleId}>`)
            .setColor(0x980e00);
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
  
        try {
          // Check if the user has the PUPS role
          const role = interaction.guild.roles.cache.get(config.pupsRoleId);
          const member = interaction.guild.members.cache.get(user.id);
          if (!member.roles.cache.has(role.id)) {
            return interaction.reply({ content: `<@${user.id}> doesn't have the PUPS role.`, ephemeral: true });
          }
  
          // Check if there is an active poll for this user
          const [activePolls] = await pool.execute(
            'SELECT * FROM removal_polls WHERE user_id = ? AND status = "active" AND poll_type = ?',
            [user.id, "pups"] // Specify "pups" for this check
          );
  
          if (activePolls.length > 0) {
            // If there's already an active poll, notify the user
            const poll = activePolls[0];
            const [votes] = await pool.execute('SELECT COUNT(*) as count FROM removal_vouches WHERE poll_id = ?', [poll.id]);
            const currentVotes = votes[0].count;
  
            const vouchButton = new ButtonBuilder()
              .setCustomId(`vouch_pups_${poll.id}`)
              .setLabel('Vouch')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(currentVotes >= 3);
  
            const removeButton = new ButtonBuilder()
              .setCustomId('remove_pups')
              .setLabel('Remove')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true); // Initially disabled until undo
  
            const row = new ActionRowBuilder().addComponents(vouchButton, removeButton);
  
            // Embed format when a poll is already ongoing
            const pollEmbed = new EmbedBuilder()
              .setAuthor({ name: `${user.username}`, iconURL: user.displayAvatarURL() })
              .setTitle("PUPS Demotion")
              .setDescription(`A poll is already ongoing for <@${user.id}> regarding demotion from <@&${config.pupsRoleId}>.`)
              .addFields({ name: 'Vouches', value: `\`\`\`${currentVotes}\`\`\`` })
              .setFooter({ text: 'Click the button to vouch', iconURL: interaction.guild.iconURL() })
              .setColor('#3640b7')
              .setTimestamp();
  
            return interaction.reply({
              embeds: [pollEmbed],
              components: [row],
              ephemeral: true // Make sure the initiator gets an ephemeral response
            });
          } else {
            // No active poll, create a new one
            const [pollInsert] = await pool.execute(
                'INSERT INTO removal_polls (user_id, initiator_id, reason, status, poll_type) VALUES (?, ?, ?, "active", ?)',
                [user.id, interaction.member.id, "Pending Reason", "pups"] // Use "pups" for PUPS polls
              );
  
            const pollId = pollInsert.insertId;
  
            const vouchButton = new ButtonBuilder()
              .setCustomId(`vouch_pups_${pollId}`)
              .setLabel('Vouch')
              .setStyle(ButtonStyle.Primary);
  
            const removeButton = new ButtonBuilder()
              .setCustomId('remove_pups')
              .setLabel('Remove')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true); // Initially disabled
  
            const row = new ActionRowBuilder().addComponents(vouchButton, removeButton);
  
            // Initial embed for command initiator
            const initialEmbed = new EmbedBuilder()
              .setDescription(`Vouches Required\n> In order to remove <@${user.id}> from <@&${config.pupsRoleId}>, you need at least \`6\` vouches.`)
              .setFooter({ text: 'Click the button to vouch', iconURL: interaction.guild.iconURL() })
              .setColor('#3640b7')
              .setTimestamp();
  
            await interaction.reply({
              embeds: [initialEmbed],
              components: [row],
              ephemeral: true
            });
  
            // Send message to #pups-vouching channel
            const pupsVouchingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pups-vouching');
            if (pupsVouchingChannel) {
              const vouchingEmbed = new EmbedBuilder()
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setTitle("Vouch for Demotion")
                .setDescription(`A poll has been created for <@${user.id}> regarding demotion from <@&${config.pupsRoleId}>. Click the button to vouch.`)
                .addFields({ name: 'Vouches', value: `\`\`\`0\`\`\`` })
                .setFooter({ text: 'Click the button to vouch', iconURL: interaction.guild.iconURL() })
                .setColor('#3640b7')
                .setTimestamp();
  
              const vouchMessage = await pupsVouchingChannel.send({
                embeds: [vouchingEmbed],
                components: [row]
              });
  
              // Store the message ID for later updates
              await pool.execute('UPDATE removal_polls SET vouch_message_id = ? WHERE id = ?', [vouchMessage.id, pollId]);
            }
          }
  
        } catch (error) {
          console.error('Error during the removal process:', error);
          return interaction.reply({ content: 'An error occurred while processing the removal.', ephemeral: true });
        }
      }
    }
  });
  
  // Handle the Vouch Button
client.on('interactionCreate', async interaction => {
   if (!interaction.isButton()) return;
  
   if (interaction.customId.startsWith('vouch_pups_')) {
      const pollId = interaction.customId.split('_')[2];
  
      try {
        // Fetch poll details
        const [poll] = await pool.execute('SELECT status FROM removal_polls WHERE id = ?', [pollId]);
  
        // Check if the poll is already closed
        if (poll[0].status === 'closed') {
          return interaction.reply({
            content: `This poll has already ended and cannot accept more vouches.`,
            ephemeral: true
          });
        }
  
        // Allow anyone with the appropriate role to vouch
        const managerRole = interaction.guild.roles.cache.get(config.pupsManagerRoleId);
        if (!interaction.member.roles.cache.has(managerRole.id) &&
            !interaction.member.roles.cache.has(config.premiumManagerRoleId) &&
            !interaction.member.roles.cache.has(config.pugsManagerRoleId)) {
          return interaction.reply({
            content: `You don't have permission to vouch for this removal.`,
            ephemeral: true
          });
        }
  
        // Check if the user has already vouched for this poll
        const [existingVote] = await pool.execute(
          'SELECT * FROM removal_vouches WHERE poll_id = ? AND manager_id = ?',
          [pollId, interaction.member.id]
        );
  
        if (existingVote.length > 0) {
          return interaction.reply({
            content: `You have already vouched for this removal.`,
            ephemeral: true
          });
        }
  
        // Show the modal to collect the reason for demotion
        const modal = new ModalBuilder()
          .setCustomId(`vouch_reason_pups_${pollId}`)
          .setTitle('Vouch for Demotion');
  
        const reasonInput = new TextInputBuilder()
          .setCustomId('reason_input')
          .setLabel('Reason for Demotion')
          .setStyle(TextInputStyle.Paragraph);
  
        const modalRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(modalRow);
  
        await interaction.showModal(modal);
      } catch (error) {
        console.error('Error during vouch process:', error);
        return interaction.reply({ content: 'An error occurred while processing the vouch.', ephemeral: true });
      }
    }
  });
  
// Handle Modal Submission for Vouch
client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId.startsWith('vouch_reason_pups_')) {
        const pollId = parseInt(interaction.customId.split('_')[3], 10); // Adjusted index
        const reason = interaction.fields.getTextInputValue('reason_input');
      try {
        // Defer the reply to prevent timeout errors
        await interaction.deferReply({ ephemeral: true });
  
        // Insert vouch into the database with the parsed pollId
        await pool.execute(
          'INSERT INTO removal_vouches (poll_id, manager_id, reason) VALUES (?, ?, ?)',
          [pollId, interaction.member.id, reason]
        );
  
        // Update the reason for the poll if the vouch came from the poll initiator
        const [poll] = await pool.execute('SELECT initiator_id FROM removal_polls WHERE id = ?', [pollId]);
        const initiatorId = poll[0].initiator_id;
  
        if (interaction.member.id === initiatorId) {
          // Update the poll reason with the initiator's reason
          await pool.execute('UPDATE removal_polls SET reason = ? WHERE id = ?', [reason, pollId]);
        }
  
        // Get updated vote count
        const [votes] = await pool.execute('SELECT COUNT(*) as count FROM removal_vouches WHERE poll_id = ?', [pollId]);
        const currentVotes = votes[0].count;
  
        // Fetch poll details including userId and vouchMessageId
        const [pollDetails] = await pool.execute('SELECT * FROM removal_polls WHERE id = ?', [pollId]);
        const userId = pollDetails[0].user_id;
        const vouchMessageId = pollDetails[0].vouch_message_id;
        const pollReason = pollDetails[0].reason;
  
        // Fetch user and update the vouch message
        let user = interaction.guild.members.cache.get(userId);
        if (!user) {
          try {
            user = await interaction.guild.members.fetch(userId);
          } catch (fetchError) {
            return interaction.followUp({ content: `User not found or has left the server.`, ephemeral: true });
          }
        }
  
        // Update the vouch message in #pups-vouching
        const pupsVouchingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pups-vouching');
        const vouchMessage = await pupsVouchingChannel.messages.fetch(vouchMessageId);
  
        // Update the vouch embed
        const updatedVouchEmbed = new EmbedBuilder()
          .setAuthor({ name: user.user.username, iconURL: user.user.displayAvatarURL() })
          .setTitle("PUPS Demotion")
          .setDescription(`A poll has been created for <@${userId}> regarding demotion from <@&${config.pupsRoleId}>.`)
          .addFields({ name: 'Vouches', value: `\`\`\`${currentVotes}\`\`\`` })
          .setFooter({ text: 'Click the button to vouch', iconURL: interaction.guild.iconURL() })
          .setColor('#3640b7')
          .setTimestamp();
  
        await vouchMessage.edit({ embeds: [updatedVouchEmbed] });
  
        // Handle the final vote
        if (currentVotes >= 6) {
          // Demote the user by removing the role
          const role = interaction.guild.roles.cache.get(config.pupsRoleId);
          const member = interaction.guild.members.cache.get(userId);
          await closePreviousPoll(pollId);

            if (member && member.roles.cache.has(role.id)) {
            await member.roles.remove(role);

            // Update the embed to indicate demotion and disable the vouch button
            const finalVouchEmbed = new EmbedBuilder()
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() }) // Correct reference to the demoted member
                .setTitle("PUPS Removal")
                .setDescription(`**<@${userId}> has been removed from <@&${config.pupsRoleId}>.**`) // Removed from PUPS
                .addFields(
                { name: 'Removed by', value: `<@${initiatorId}>`, inline: true }, // Mention who removed them
                { name: 'Reason', value: `> ${pollReason}`, inline: false }        // The reason for demotion
                )
                .setFooter({ text: `${member.user.username} has been demoted`, iconURL: interaction.guild.members.cache.get(initiatorId).user.displayAvatarURL() }) // Footer now mentions the demoted user, but shows the initiator's pfp
                .setColor('#e91e63') // Red color for demotion
                .setTimestamp(); // Current timestamp

  
            // Create undo and remove buttons
            const undoButton = new ButtonBuilder()
              .setCustomId(`undo_pups_${pollId}`)
              .setLabel('Undo')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(false); // Keep the Undo button visible
  
            const removeButton = new ButtonBuilder()
              .setCustomId(`remove_pups_${pollId}`)
              .setLabel('Remove')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true); // Initially disabled until undo is clicked
  
            const vouchButton = new ButtonBuilder()
              .setCustomId(`vouch_pups_${pollId}`)
              .setLabel('Vouch')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true); // Disable after demotion
  
            // Updated Action Row to reflect correct button order: Vouch, Remove, Undo
            const row = new ActionRowBuilder().addComponents(vouchButton, removeButton, undoButton);
  
            // Update the embed and components in #pups-vouching
            await vouchMessage.edit({ embeds: [finalVouchEmbed], components: [row] });
  
            // Announce demotion in #pups-voting
            const votingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pups-voting');
            if (votingChannel) {
              await votingChannel.send({ embeds: [finalVouchEmbed] });
            }
  
            return interaction.followUp({
              content: `<@${userId}> has been demoted successfully.`,
              ephemeral: true
            });
          } else {
            return interaction.followUp({ content: 'User no longer has the PUPS role or has left the server.', ephemeral: true });
          }
        } else {
          // Still need more vouches
          return interaction.followUp({
            content: `Vouched successfully! You need \`${6 - currentVotes}\` more vouches.`,
            ephemeral: true
          });
        }
      } catch (error) {
        console.error('Error during vouch process:', error);
        return interaction.followUp({ content: 'An error occurred while processing the vouch.', ephemeral: true });
      }
    }
  });
  
  // Handle Undo Button
  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || !interaction.customId.startsWith('undo_pups_')) return;
  
    const pollId = interaction.customId.split('_')[2];
  
    try {
      const [poll] = await pool.execute('SELECT * FROM removal_polls WHERE id = ?', [pollId]);
      const userId = poll[0].user_id;
      await closePreviousPoll(pollId);
      const role = interaction.guild.roles.cache.get(config.pupsRoleId);
      const member = interaction.guild.members.cache.get(userId);
  
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
  
        // Update the embed to show that the user was added back
        const pupsVouchingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pups-vouching');
        const vouchMessage = await pupsVouchingChannel.messages.fetch(poll[0].vouch_message_id);
  
        const updatedEmbed = new EmbedBuilder()
          .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
          .setDescription(`Update: <@${userId}> has been added back to PUPS.`)
          .addFields({ name: 'Vouches', value: `\`\`\`3\`\`\`` }) // Keep the vouches as they are
          .setFooter({ text: `${interaction.user.username} has added ${member.user.username} back to PUPS`, iconURL: interaction.user.displayAvatarURL() })
          .setColor('#00FF00')  // Green to indicate success
          .setTimestamp();
  
        const vouchButton = new ButtonBuilder()
          .setCustomId(`vouch_pups_${pollId}`)
          .setLabel('Vouch')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true); // Vouch stays disabled
  
        const removeButton = new ButtonBuilder()
          .setCustomId(`remove_pups_${pollId}`)
          .setLabel('Remove')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(false); // Enable the Remove button
  
        const undoButton = new ButtonBuilder()
          .setCustomId(`undo_pups_${pollId}`)
          .setLabel('Undo')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true); // Disable the undo button but keep it visible
  
        // Updated Action Row to reflect correct button order: Vouch, Remove, Undo
        const row = new ActionRowBuilder().addComponents(vouchButton, removeButton, undoButton);
  
        await vouchMessage.edit({ embeds: [updatedEmbed], components: [row] });
  
        return interaction.reply({
          content: `The user <@${userId}> has been restored to the PUPS role.`,
          ephemeral: true
        });
      } else {
        return interaction.reply({ content: `The user <@${userId}> already has the PUPS role.`, ephemeral: true });
      }
    } catch (error) {
      console.error('Error during undo process:', error);
      return interaction.reply({ content: 'An error occurred while processing the undo.', ephemeral: true });
    }
  });
  
  
  // Handle Remove Button After Undo
  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || !interaction.customId.startsWith('remove_pups_')) return;
  
    const pollId = interaction.customId.split('_')[2];
  
    try {
      const [poll] = await pool.execute('SELECT * FROM removal_polls WHERE id = ?', [pollId]);
      const userId = poll[0].user_id;
      await closePreviousPoll(pollId);
      const role = interaction.guild.roles.cache.get(config.pupsRoleId);
      const member = interaction.guild.members.cache.get(userId);
  
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
  
        // Update the embed to show the final removal
        const pupsVouchingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pups-vouching');
        const vouchMessage = await pupsVouchingChannel.messages.fetch(poll[0].vouch_message_id);
  
        const finalEmbed = new EmbedBuilder()
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() }) // Set to the demoted user's pfp and name
            .setTitle("PUPS Demotion") // Updated title
            .setDescription(`**<@${userId}> has been removed from <@&${config.pupsRoleId}>.**`) // Demotion message
            .addFields({ name: 'Vouches', value: `\`\`\`3\`\`\`` }) // Keep vouches, final count
            .setFooter({ text: `${member.user.username} has been demoted`, iconURL: interaction.guild.members.cache.get(initiatorId).user.displayAvatarURL() }) // Footer updated to show the demoted user and initiator's pfp
            .setColor('#e91e63') // Red color for demotion
            .setTimestamp(); // Include timestamp

  
        const vouchButton = new ButtonBuilder()
          .setCustomId(`vouch_pups_${pollId}`)
          .setLabel('Vouch')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true); // Keep vouch disabled
  
        const removeButton = new ButtonBuilder()
          .setCustomId(`remove_pups_${pollId}`)
          .setLabel('Remove')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true); // Disable all buttons
  
        const row = new ActionRowBuilder().addComponents(vouchButton, removeButton);
  
        await vouchMessage.edit({ embeds: [finalEmbed], components: [row] });
  
        return interaction.reply({
          content: `<@${userId}> has been removed from the PUPS role.`,
          ephemeral: true
        });
      } else {
        return interaction.reply({ content: `The user <@${userId}> does not have the PUPS role.`, ephemeral: true });
      }
    } catch (error) {
      console.error('Error during final removal process:', error);
      return interaction.reply({ content: 'An error occurred while processing the final removal.', ephemeral: true });
    }
  });
async function closePreviousPoll(pollId) {
    await pool.execute('UPDATE removal_polls SET status = "closed" WHERE id = ?', [pollId]);
}
       
  

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || interaction.commandName !== 'pups') return;

    const { commandName, options } = interaction;

    if (commandName === 'pups') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'myvote') {
            const userId = interaction.user.id;
            let [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pups" ORDER BY created_at DESC', [userId]);

            if (polls.length === 0) {
                const noPollsEmbed = new EmbedBuilder()
                    .setDescription('```ini\nYou do not have any polls```\n')
                    .setColor('#D72F2F');
                return interaction.reply({ embeds: [noPollsEmbed], ephemeral: true });
            }

            const pollIndex = 0; // Start with the first poll
            const poll = polls[pollIndex];
            const status = poll.active ? 'active' : 'inactive';
            const user = interaction.user;

            const pollEmbed = new EmbedBuilder()
                .setAuthor({ name: `${user.username} | PUPS Vote`, iconURL: user.displayAvatarURL() })
                .setDescription(`Mode: **PUPS** [${pollIndex + 1}/${polls.length}]\n ▬▬▬▬▬▬▬▬▬▬▬▬▬▬
\n **Upvotes 👍**\n\`\`\`${poll.upvotes}\`\`\`\n**Downvotes 👎**\n\`\`\`${poll.downvotes}\`\`\`\n ▬▬▬▬▬▬▬▬▬▬▬▬▬▬
\n> This poll is currently __\`\`${status}\`\`__`)
                .setColor('#e96d6d')
                .setTimestamp();


            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`prev_pups_${userId}_${pollIndex}`)
                        .setEmoji('⬅️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(pollIndex === 0),
                    new ButtonBuilder()
                        .setCustomId(`next_pups_${userId}_${pollIndex}`)
                        .setEmoji('➡️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(pollIndex === polls.length - 1)
                );

            await interaction.reply({ embeds: [pollEmbed], components: [buttons], ephemeral: false });
        }
    }
});

// Handler for navigation buttons
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    if (customId.startsWith('prev_pups_') || customId.startsWith('next_pups_')) {
        const parts = customId.split('_');

        if (parts.length < 4) {
            console.error(`Invalid customId: ${customId}`);
            return;
        }

        const action = parts[0];
        const userId = parts[2];
        let pollIndex = parseInt(parts[3]);

        if (interaction.user.id !== userId) {
            const errorEmbed = new EmbedBuilder()
                .setDescription(`> Only <@${userId}> can interact with this button.`)
                .setColor('#D72F2F');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        if (action === 'prev') pollIndex -= 1;
        if (action === 'next') pollIndex += 1;

        let [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pups" ORDER BY created_at DESC', [userId]);

        if (polls.length === 0 || pollIndex < 0 || pollIndex >= polls.length) {
            const noPollsEmbed = new EmbedBuilder()
                .setDescription('```ini\nYou do not have any polls```\n')
                .setColor('#D72F2F');
            return interaction.update({ embeds: [noPollsEmbed], components: [], ephemeral: true });
        }

        const poll = polls[pollIndex];
        const status = poll.active ? 'active' : 'inactive';
        const user = interaction.user;

        const pollEmbed = new EmbedBuilder()
            .setAuthor({ name: `${user.username} | PUPS Vote`, iconURL: user.displayAvatarURL() })
            .setDescription(`Mode: **PUPS** [${pollIndex + 1}/${polls.length}]\n ▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n **Upvotes 👍**\n\`\`\`${poll.upvotes}\`\`\`\n**Downvotes 👎**\n\`\`\`${poll.downvotes}\`\`\`\n ▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n> This poll is currently __\`\`${status}\`\`__`)
            .setColor('#e96d6d')
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev_pups_${userId}_${pollIndex}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pollIndex === 0),
                new ButtonBuilder()
                    .setCustomId(`next_pups_${userId}_${pollIndex}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pollIndex === polls.length - 1)
            );

        await interaction.update({ embeds: [pollEmbed], components: [buttons], ephemeral: false });
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || interaction.commandName !== 'pups') return;

    const { commandName, options } = interaction;

    if (commandName === 'pups') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'list') {
            const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);
            

            const membersWithRole = await interaction.guild.members.fetch();
            const membersArray = membersWithRole.filter(member => member.roles.cache.has(pupsRole.id)).map(member => member);
            const pageSize = 10;
            const totalPages = Math.ceil(membersArray.length / pageSize);

            if (totalPages === 0) {
                const noMembersEmbed = new EmbedBuilder()
                    .setDescription('```ini\nNo members with PUPS role found.\n```')
                    .setColor(0x980e00);
                return interaction.reply({ embeds: [noMembersEmbed], ephemeral: true });
            }

            const currentPage = 0; // Start with the first page
            const paginatedMembers = membersArray.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

            const memberList = paginatedMembers.map((member, index) => `\`\`${index + 1 + currentPage * pageSize}.\`\` <@${member.id}>`).join('\n');
            const userPosition = membersArray.findIndex(member => member.id === interaction.user.id) + 1;

            const listEmbed = new EmbedBuilder()
                .setAuthor({ name: 'PUPS List', iconURL: interaction.guild.iconURL() })
                .setDescription(`Mode: **PUPS** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
                .setFooter({ text: `${userPosition}. [${interaction.user.username}]`, iconURL: interaction.user.displayAvatarURL() })
                .setColor('#e96d6d');

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
        }
    }
});

// Handler for PUPS navigation buttons
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    if (customId.startsWith('prev_list_pups_') || customId.startsWith('next_list_pups_')) {
        const parts = customId.split('_');

        if (parts.length < 5) {
            console.error(`Invalid customId: ${customId}`);
            return;
        }

        const action = parts[0]; // Expecting 'prev' or 'next'
        const userId = parts[3];
        let currentPage = parseInt(parts[4]);

        if (interaction.user.id !== userId) {
            const errorEmbed = new EmbedBuilder()
                .setDescription(`> Only <@${userId}> can interact with this button.`)
                .setColor('#D72F2F');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        if (action === 'prev') currentPage -= 1;
        if (action === 'next') currentPage += 1;

        const pupsRole = interaction.guild.roles.cache.get(config.pupsRoleId);
        const membersWithRole = await interaction.guild.members.fetch();
        const membersArray = membersWithRole.filter(member => member.roles.cache.has(pupsRole.id)).map(member => member);
        const pageSize = 10;
        const totalPages = Math.ceil(membersArray.length / pageSize);

        if (totalPages === 0 || currentPage < 0 || currentPage >= totalPages) {
            const noMembersEmbed = new EmbedBuilder()
                .setDescription('```ini\nNo members with PUPS role found.\n```')
                .setColor('#D72F2F');
            return interaction.update({ embeds: [noMembersEmbed], components: [], ephemeral: true });
        }

        const paginatedMembers = membersArray.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
        const memberList = paginatedMembers.map((member, index) => `\`\`${index + 1 + currentPage * pageSize}.\`\` <@${member.id}>`).join('\n');
        const userPosition = membersArray.findIndex(member => member.id === interaction.user.id) + 1;

        const listEmbed = new EmbedBuilder()
            .setAuthor({ name: 'PUPS List', iconURL: interaction.guild.iconURL() })
            .setDescription(`Mode: **PUPS** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
            .setFooter({ text: `${userPosition}. [${interaction.user.username}]`, iconURL: interaction.user.displayAvatarURL() })
            .setColor('#e96d6d');

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

        await interaction.update({ embeds: [listEmbed], components: [buttons], ephemeral: false });
    }
});
// pugs voting
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || interaction.commandName !== 'pugs') return;

    const { commandName, options } = interaction;

    if (commandName === 'pugs') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'myvote') {
            const userId = interaction.user.id;
            let [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pugs" ORDER BY created_at DESC', [userId]);

            if (polls.length === 0) {
                const noPollsEmbed = new EmbedBuilder()
                    .setDescription('```ini\nYou do not have any polls```\n')
                    .setColor('#D72F2F');
                return interaction.reply({ embeds: [noPollsEmbed], ephemeral: true });
            }

            const pollIndex = 0; // Start with the first poll
            const poll = polls[pollIndex];
            const status = poll.active ? 'active' : 'inactive';
            const user = interaction.user;

            const pollEmbed = new EmbedBuilder()
                .setAuthor({ name: `${user.username} | PUGS Vote`, iconURL: user.displayAvatarURL() })
                .setDescription(`Mode: **PUGS** [${pollIndex + 1}/${polls.length}]\n ▬▬▬▬▬▬▬▬▬▬▬▬▬▬
\n **Upvotes 👍**\n\`\`\`${poll.upvotes}\`\`\`\n**Downvotes 👎**\n\`\`\`${poll.downvotes}\`\`\`\n ▬▬▬▬▬▬▬▬▬▬▬▬▬▬
\n> This poll is currently __\`\`${status}\`\`__`)
                .setColor('#b90d1a')
                .setTimestamp();

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`prev_pugs_${userId}_${pollIndex}`)
                        .setEmoji('⬅️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(pollIndex === 0),
                    new ButtonBuilder()
                        .setCustomId(`next_pugs_${userId}_${pollIndex}`)
                        .setEmoji('➡️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(pollIndex === polls.length - 1)
                );

            await interaction.reply({ embeds: [pollEmbed], components: [buttons], ephemeral: false });
        }

        if (subcommand === 'list') {
            const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
            

            const membersWithRole = await interaction.guild.members.fetch();
            const membersArray = membersWithRole.filter(member => member.roles.cache.has(pugsRole.id)).map(member => member);
            const pageSize = 10;
            const totalPages = Math.ceil(membersArray.length / pageSize);

            if (totalPages === 0) {
                const noMembersEmbed = new EmbedBuilder()
                    .setDescription('```ini\nNo members with PUGS role found.\n```')
                    .setColor(0x980e00);
                return interaction.reply({ embeds: [noMembersEmbed], ephemeral: true });
            }

            const currentPage = 0; // Start with the first page
            const paginatedMembers = membersArray.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

            const memberList = paginatedMembers.map((member, index) => `\`\`${index + 1 + currentPage * pageSize}.\`\` <@${member.id}>`).join('\n');
            const userPosition = membersArray.findIndex(member => member.id === interaction.user.id) + 1;

            const listEmbed = new EmbedBuilder()
                .setAuthor({ name: 'PUGS List', iconURL: interaction.guild.iconURL() })
                .setDescription(`Mode: **PUGS** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
                .setFooter({ text: `${userPosition}. [${interaction.user.username}]`, iconURL: interaction.user.displayAvatarURL() })
                .setColor('#b90d1a');

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`prev_list_pugs_${interaction.user.id}_${currentPage}`)
                        .setEmoji('⬅️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId(`next_list_pugs_${interaction.user.id}_${currentPage}`)
                        .setEmoji('➡️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === totalPages - 1)
                );

            await interaction.reply({ embeds: [listEmbed], components: [buttons], ephemeral: false });
        }
    }
});

// Handler for navigation buttons
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    if (customId.startsWith('prev_pugs_') || customId.startsWith('next_pugs_')) {
        const parts = customId.split('_');

        if (parts.length < 4) {
            console.error(`Invalid customId: ${customId}`);
            return;
        }

        const action = parts[0];
        const userId = parts[2];
        let pollIndex = parseInt(parts[3]);

        if (interaction.user.id !== userId) {
            const errorEmbed = new EmbedBuilder()
                .setDescription(`> Only <@${userId}> can interact with this button.`)
                .setColor('#D72F2F');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        if (action === 'prev') pollIndex -= 1;
        if (action === 'next') pollIndex += 1;

        let [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pugs" ORDER BY created_at DESC', [userId]);

        if (polls.length === 0 || pollIndex < 0 || pollIndex >= polls.length) {
            const noPollsEmbed = new EmbedBuilder()
                .setDescription('```ini\nYou do not have any polls```\n')
                .setColor('#D72F2F');
            return interaction.update({ embeds: [noPollsEmbed], components: [], ephemeral: true });
        }

        const poll = polls[pollIndex];
        const status = poll.active ? 'active' : 'inactive';
        const user = interaction.user;

        const pollEmbed = new EmbedBuilder()
            .setAuthor({ name: `${user.username} | PUGS Vote`, iconURL: user.displayAvatarURL() })
            .setDescription(`Mode: **PUGS** [${pollIndex + 1}/${polls.length}]\n ▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n **Upvotes 👍**\n\`\`\`${poll.upvotes}\`\`\`\n**Downvotes 👎**\n\`\`\`${poll.downvotes}\`\`\`\n ▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n> This poll is currently __\`\`${status}\`\`__`)
            .setColor('#b90d1a')
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev_pugs_${userId}_${pollIndex}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pollIndex === 0),
                new ButtonBuilder()
                    .setCustomId(`next_pugs_${userId}_${pollIndex}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pollIndex === polls.length - 1)
            );

        await interaction.update({ embeds: [pollEmbed], components: [buttons], ephemeral: false });
    }

    if (customId.startsWith('prev_list_pugs_') || customId.startsWith('next_list_pugs_')) {
        const parts = customId.split('_');

        if (parts.length < 5) {
            console.error(`Invalid customId: ${customId}`);
            return;
        }

        const action = parts[0];
        const userId = parts[3];
        let currentPage = parseInt(parts[4]);

        if (interaction.user.id !== userId) {
            const errorEmbed = new EmbedBuilder()
                .setDescription(`> Only <@${userId}> can interact with this button.`)
                .setColor('#D72F2F');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        if (action === 'prev') currentPage -= 1;
        if (action === 'next') currentPage += 1;

        const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
        const membersWithRole = await interaction.guild.members.fetch();
        const membersArray = membersWithRole.filter(member => member.roles.cache.has(pugsRole.id)).map(member => member);
        const pageSize = 10;
        const totalPages = Math.ceil(membersArray.length / pageSize);

        if (totalPages === 0 || currentPage < 0 || currentPage >= totalPages) {
            const noMembersEmbed = new EmbedBuilder()
                .setDescription('```ini\nNo members with PUGS role found.\n```')
                .setColor('#D72F2F');
            return interaction.update({ embeds: [noMembersEmbed], components: [], ephemeral: true });
        }

        const paginatedMembers = membersArray.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
        const memberList = paginatedMembers.map((member, index) => `\`\`${index + 1 + currentPage * pageSize}.\`\` <@${member.id}>`).join('\n');
        const userPosition = membersArray.findIndex(member => member.id === interaction.user.id) + 1;

        const listEmbed = new EmbedBuilder()
            .setAuthor({ name: 'PUGS List', iconURL: interaction.guild.iconURL() })
            .setDescription(`Mode: **PUGS** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
            .setFooter({ text: `${userPosition}. [${interaction.user.username}]`, iconURL: interaction.user.displayAvatarURL() })
            .setColor('#b90d1a');

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev_list_pugs_${userId}_${currentPage}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`next_list_pugs_${userId}_${currentPage}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1)
            );
        await interaction.update({ embeds: [listEmbed], components: [buttons], ephemeral: false });
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || interaction.commandName !== 'pugs') return;

    const { commandName, options } = interaction;

    if (commandName === 'pugs') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'vote') {
            const user = options.getUser('user');
            const managerRole = interaction.guild.roles.cache.get(config.pugsManagerRoleId);

            if (!interaction.member.roles.cache.has(managerRole.id) && !interaction.member.roles.cache.has(config.premiumManagerRoleId)) {
                const embed = new EmbedBuilder()
                .setDescription(`Only people with these roles can use this command:\n- <@&${config.premiumManagerRoleId}> \n- <@&${config.pugsManagerRoleId}>`)
                .setColor(0x980e00);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }            

            const [rows] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pugs" AND active = 1', [user.id]);
            if (rows.length > 0) {
                const embed = new EmbedBuilder()
                    .setDescription('A poll is already active for this user.')
                    .setColor(0x980e00);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            await pool.execute('INSERT INTO polls (user_id, type, upvotes, downvotes, active) VALUES (?, "pugs", 0, 0, 1)', [user.id]);

            const embed = new EmbedBuilder()
                .setAuthor({ name: `${user.username} | PUGS Vote`, iconURL: user.displayAvatarURL() })
                .setDescription(`A vote has been created for <@${user.id}> to join <@&${config.pugsRoleId}>.\n\n**Upvotes 👍**\n\`\`\`0                                        \`\`\`\n**Downvotes 👎**\n\`\`\`0                                        \`\`\``)
                .setFooter({ text: `Created by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setColor('#b90d1a');

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`upvote_pugs_${user.id}`)
                        .setLabel('Upvote')
                        .setEmoji('👍')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`downvote_pugs_${user.id}`)
                        .setLabel('Downvote')
                        .setEmoji('👎')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`end_vote_pugs_${user.id}`)
                        .setLabel('End Vote')
                        .setStyle(ButtonStyle.Secondary)
                );

            const channel = interaction.guild.channels.cache.find(ch => ch.name === 'pugs-voting');
            await channel.send({ content: `<@&${config.pugsRoleId}>`, embeds: [embed], components: [buttons] });

            return interaction.reply({ embeds: [new EmbedBuilder().setDescription('Vote created.').setColor(0xad1457)], ephemeral: true });
        }
    }
});
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Check for voting-related actions
    if (customId.startsWith('upvote_pugs_') || customId.startsWith('downvote_pugs_')) {
        const parts = customId.split('_');

        if (parts.length < 3) {
            console.error(`Invalid customId: ${customId}`);
            return;
        }

        const action = parts[0];
        const type = parts[1];
        const targetUserId = parts.slice(2).join('_'); // Join remaining parts to handle any underscores in user IDs

        console.log(`Parsed customId - Action: ${action}, Type: ${type}, UserId: ${targetUserId}`);

        if (type !== 'pugs') {
            console.log(`Ignoring non-pugs type: ${type}`);
            return; // Ensure this only processes "pugs" related buttons
        }

        const [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pugs" AND active = 1', [targetUserId]);
        if (polls.length === 0) {
            console.error('No active poll found for the user.');
            return interaction.reply({ content: 'No active poll found for this user.', ephemeral: true });
        }

        const poll = polls[0];
        const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
        const managerRole = interaction.guild.roles.cache.get(config.pugsManagerRoleId);

        console.log(`User ${interaction.user.id} clicked ${action} on poll for user ${targetUserId}`);

        if (!interaction.member.roles.cache.has(pugsRole.id) && !interaction.member.roles.cache.has(config.premiumRoleId)) {
            return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`Only members with the roles below can vote.\n- <@&${config.premiumRoleId}>\n- <@&${config.pugsRoleId}>`).setColor(0x980e00)], ephemeral: true });
        }

        if (interaction.user.id === targetUserId) {
            return interaction.reply({ embeds: [new EmbedBuilder().setDescription('You cannot vote on your own poll.').setColor(0x980e00)], ephemeral: true });
        }

        // Check if the user has voted in the current poll, not any previous polls
        const [alreadyVoted] = await pool.execute('SELECT * FROM votes WHERE user_id = ? AND poll_id = ?', [interaction.user.id, poll.id]);

        if (alreadyVoted.length > 0) {
            console.log(`User ${interaction.user.id} has already voted on poll for user ${targetUserId}`);
            return interaction.reply({ embeds: [new EmbedBuilder().setDescription('You have already voted.').setColor(0x980e00)], ephemeral: true });
        }

        const [userCheck] = await pool.execute('SELECT * FROM users WHERE userID = ?', [interaction.user.id]);
        if (userCheck.length === 0) {
            await pool.execute('INSERT INTO users (userID) VALUES (?)', [interaction.user.id]);
        }

        if (action === 'upvote') {
            await pool.execute('UPDATE polls SET upvotes = upvotes + 1 WHERE id = ?', [poll.id]);
            await pool.execute('INSERT INTO votes (user_id, poll_user_id, poll_id, type, vote) VALUES (?, ?, ?, "pugs", "upvote")', [interaction.user.id, targetUserId, poll.id]);
            console.log(`User ${interaction.user.id} upvoted poll for user ${targetUserId}`);
        } else if (action === 'downvote') {
            await pool.execute('UPDATE polls SET downvotes = downvotes + 1 WHERE id = ?', [poll.id]);
            await pool.execute('INSERT INTO votes (user_id, poll_user_id, poll_id, type, vote) VALUES (?, ?, ?, "pugs", "downvote")', [interaction.user.id, targetUserId, poll.id]);
            console.log(`User ${interaction.user.id} downvoted poll for user ${targetUserId}`);
        }

        const [updatedPoll] = await pool.execute('SELECT * FROM polls WHERE id = ?', [poll.id]);
        const embed = new EmbedBuilder()
            .setAuthor({ name: `${interaction.message.embeds[0].author.name}`, iconURL: interaction.message.embeds[0].author.iconURL })
            .setDescription(`A vote has been created for <@${targetUserId}> to join <@&${config.pugsRoleId}>.\n\n**Upvotes 👍**\n\`\`\`${updatedPoll[0].upvotes}                                        \`\`\`\n**Downvotes 👎**\n\`\`\`${updatedPoll[0].downvotes}                                        \`\`\``)
            .setColor('#b90d1a')
            .setFooter({ text: `Created by ${interaction.message.embeds[0].footer.text.replace('Created by ', '')}`, iconURL: interaction.message.embeds[0].footer.iconURL });

        try {
            await interaction.update({ embeds: [embed] });
            return interaction.followUp({ embeds: [new EmbedBuilder().setDescription(`${action === 'upvote' ? 'Upvoted' : 'Downvoted'}.`).setColor(0xad1457)], ephemeral: true });
        } catch (error) {
            console.error('Error updating interaction:', error);
            return interaction.reply({ content: 'Error updating interaction.', ephemeral: true });
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Check for end_vote action
    if (customId.startsWith('end_vote_pugs_')) {
        const parts = customId.split('_');

        if (parts.length < 4) {
            console.error(`Invalid customId: ${customId}`);
            return;
        }

        const action = parts[0] + '_' + parts[1]; // Action is 'end_vote'
        const type = parts[2];
        const targetUserId = parts.slice(3).join('_'); // Join remaining parts to handle any underscores in user IDs

        console.log(`Parsed customId - Action: ${action}, Type: ${type}, UserId: ${targetUserId}`);

        if (type !== 'pugs') {
            console.log(`Ignoring non-pugs type: ${type}`);
            return; // Ensure this only processes "pugs" related buttons
        }

        const [polls] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pugs" AND active = 1', [targetUserId]);
        if (polls.length === 0) {
            console.error('No active poll found for the user.');
            return interaction.reply({ content: 'No active poll found for this user.', ephemeral: true });
        }

        const poll = polls[0];
        const managerRole = interaction.guild.roles.cache.get(config.pugsManagerRoleId);

        console.log(`User ${interaction.user.id} clicked end_vote on poll for user ${targetUserId}`);

        if (!interaction.member.roles.cache.has(managerRole.id) && !interaction.member.roles.cache.has(config.premiumManagerRoleId)) {
            const embed = new EmbedBuilder()
                .setDescription(`Only people with these roles can use this button:\n- <@&${config.premiumManagerRoleId}>\n- <@&${config.pugsManagerRoleId}>`)
                .setColor(0x980e00);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await pool.execute('UPDATE polls SET active = 0 WHERE id = ?', [poll.id]);

        const upvotes = poll.upvotes;
        const downvotes = poll.downvotes;
        const result = upvotes > downvotes ? 'won' : 'lost';
        const resultColor = upvotes > downvotes ? '#b90d1a' : 0x980e00;

        const disabledButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`upvote_pugs_${targetUserId}`)
                    .setLabel('Upvote')
                    .setEmoji('👍')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`downvote_pugs_${targetUserId}`)
                    .setLabel('Downvote')
                    .setEmoji('👎')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`end_vote_pugs_${targetUserId}`)
                    .setLabel('End Vote')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

        try {
            await interaction.message.edit({ components: [disabledButtons] });

            const resultEmbed = new EmbedBuilder()
                .setAuthor({ name: `${interaction.guild.members.cache.get(poll.user_id).user.username} | PUGS Vote`, iconURL: interaction.guild.members.cache.get(poll.user_id).user.displayAvatarURL() })
                .setDescription(`**Upvotes:** \`\`\`${poll.upvotes}                                            \`\`\`\n**Downvotes:** \`\`\`${poll.downvotes}                                            \`\`\`\n<@${poll.user_id}> has ${result} the vote!`)
                .setColor(resultColor)
                .setFooter({ text: `Created by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`add_to_pugs_${poll.user_id}`)
                    .setLabel('Add To PUGS')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(result === 'lost')
            );

            await interaction.reply({ embeds: [resultEmbed], components: [buttons], ephemeral: true });
            return interaction.followUp({ embeds: [new EmbedBuilder().setDescription('Vote ended.').setColor(0xad1457)], ephemeral: true });
        } catch (error) {
            console.error('Error handling end_vote interaction:', error);
            return interaction.reply({ content: 'Error handling end_vote interaction.', ephemeral: true });
        }
    }
});
config.premiumRoleId
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Check for add_to_pugs action
    if (customId.startsWith('add_to_pugs_')) {
        const parts = customId.split('_');

        if (parts.length < 3) {
            console.error(`Invalid customId: ${customId}`);
            return;
        }

        const action = parts.slice(0, 3).join('_'); // Action is 'add_to_pugs'
        const targetUserId = parts.slice(3).join('_'); // Join remaining parts to handle any underscores in user IDs

        console.log(`Parsed customId - Action: ${action}, UserId: ${targetUserId}`);

        const managerRole = interaction.guild.roles.cache.get(config.pugsManagerRoleId);

        if (!interaction.member.roles.cache.has(managerRole.id) && !interaction.member.roles.cache.has(config.premiumManagerRoleId)) {
            const embed = new EmbedBuilder()
                .setDescription(`Only people with these roles can use this button:\n- <@&${config.premiumManagerRoleId}>\n- <@&${config.pugsManagerRoleId}>`)
                .setColor(0x980e00);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
        const pugsTrialRoleId = interaction.guild.roles.cache.get(config.pugsTrialRoleId)
        const [pollResult] = await pool.execute('SELECT * FROM polls WHERE user_id = ? AND type = "pugs" AND active = 0', [targetUserId]);

        if (pollResult.length === 0) {
            console.error('No completed poll found for the user.');
            return interaction.reply({ content: 'No completed poll found for this user.', ephemeral: true });
        }

        const poll = pollResult[0];

        try {
            await interaction.guild.members.cache.get(targetUserId).roles.add(pugsTrialRoleId);
            console.log(`Added user ${targetUserId} to PUGS`);

            // Create the embed for the interaction reply
            const replyEmbed = new EmbedBuilder()
                .setDescription(`Added <@${targetUserId}> to <@&${config.pugsTrialRoleId}>.`)
                .setColor(0xad1457);

            await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

            // Create the embed for the pugs-voting channel
            const user = interaction.guild.members.cache.get(targetUserId).user;
            const votingEmbed = new EmbedBuilder()
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setTitle("PUGS Addition")
                .setDescription(`<@${targetUserId}> has been added to <@&${config.pugsTrialRoleId}>`)
                .addFields(
                    { name: 'Upvotes 👍', value: `\`\`\`${poll.upvotes}\`\`\``, inline: true },
                    { name: 'Downvotes 👎', value: `\`\`\`${poll.downvotes}\`\`\``, inline: true }
                )
                .setFooter({ text: `Added by: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setColor('#e74c3c');

            const votingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pugs-voting');
            if (votingChannel) {
                await votingChannel.send({ embeds: [votingEmbed] });
            } else {
                console.error('pugs-voting channel not found.');
            }
        } catch (error) {
            console.error('Error handling add_to_pugs interaction:', error);
            return interaction.reply({ content: 'Error handling add_to_pugs interaction.', ephemeral: true });
        }
    }
});
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || interaction.commandName !== 'pugs') return;

    const { options } = interaction;
    const subcommand = options.getSubcommand();
    const user = options.getUser('user');

    const managerRole = interaction.guild.roles.cache.get(config.pugsManagerRoleId);

    if (subcommand === 'add' || subcommand === 'remove') {
        if (!interaction.member.roles.cache.has(managerRole.id) && !interaction.member.roles.cache.has(config.premiumManagerRoleId)) {
            const embed = new EmbedBuilder()
                .setDescription(`Only people with these roles can use this command:\n- <@&${config.premiumManagerRoleId}>\n- <@&${config.pugsManagerRoleId}>`)
                .setColor(0x980e00);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);
        const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);

        try {
            if (subcommand === 'add') {
                const type = options.getString('type');
                const role = type === 'trial' ? pugsTrialRole : pugsRole;
                const color = type === 'trial' ? '#e74c3c' : '#b90d1a';

                await interaction.guild.members.cache.get(user.id).roles.add(role);
                console.log(`Added user ${user.id} to ${type === 'trial' ? 'PUGS Trial' : 'PUGS'}`);

                const embed = new EmbedBuilder()
                    .setDescription(`Added <@${user.id}> to <@&${role.id}>.`)
                    .setColor(color);

                await interaction.reply({ embeds: [embed], ephemeral: false });

                const votingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pugs-voting');
                if (votingChannel) {
                    const votingEmbed = new EmbedBuilder()
                        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                        .setTitle("PUGS Addition")
                        .setDescription(`<@${user.id}> has been added to <@&${role.id}>`)
                        .addFields({ name: 'Added by:', value: `<@${interaction.user.id}>` })
                        .setTimestamp()
                        .setColor(color);

                    await votingChannel.send({ embeds: [votingEmbed] });
                } else {
                    console.error('pugs-voting channel not found.');
                }
            } 
        } catch (error) {
            console.error(`Error processing PUGS ${subcommand}:`, error);
            return interaction.reply({ content: `Error processing PUGS ${subcommand}.`, ephemeral: true });
        }
    }
});
// pugs remove
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || interaction.commandName !== 'pugs') return;

    const { commandName, options } = interaction;

    if (commandName === 'pugs') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'remove') {
            const user = options.getUser('user');
            const managerRole = interaction.guild.roles.cache.get(config.pugsManagerRoleId);

            // Check if the member has the right role to use the command
            if (!interaction.member.roles.cache.has(managerRole.id)) {
                const embed = new EmbedBuilder()
                    .setDescription(`Only people with this role can use this command:\n- <@&${config.pugsManagerRoleId}>`)
                    .setColor(0x980e00);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            try {
                // Check if the user has the PUGS or PUGS Trial role
                const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
                const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);
                const member = interaction.guild.members.cache.get(user.id);
                const hasPugsRole = member.roles.cache.has(pugsRole.id);
                const hasPugsTrialRole = member.roles.cache.has(pugsTrialRole.id);

                if (!hasPugsRole && !hasPugsTrialRole) {
                    return interaction.reply({ content: `<@${user.id}> doesn't have any PUGS roles.`, ephemeral: true });
                }

                // Determine which role to remove
                const roleToRemove = hasPugsTrialRole ? pugsTrialRole : pugsRole;

                // Check if there is an active poll for this user
                const [activePolls] = await pool.execute(
                    'SELECT * FROM removal_polls WHERE user_id = ? AND status = "active" AND poll_type = ?',
                    [user.id, "pugs"] // Specify "pugs" for this check
                );

                if (activePolls.length > 0) {
                    // If there's already an active poll, notify the user
                    const poll = activePolls[0];
                    const [votes] = await pool.execute('SELECT COUNT(*) as count FROM removal_vouches WHERE poll_id = ?', [poll.id]);
                    const currentVotes = votes[0].count;

                    const vouchButton = new ButtonBuilder()
                        .setCustomId(`vouch_pugs_${poll.id}`)
                        .setLabel('Vouch')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentVotes >= 3);

                    const removeButton = new ButtonBuilder()
                        .setCustomId(`remove_pugs_${poll.id}`)
                        .setLabel('Remove')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true); // Initially disabled until undo

                    const row = new ActionRowBuilder().addComponents(vouchButton, removeButton);

                    // Embed format when a poll is already ongoing
                    const pollEmbed = new EmbedBuilder()
                        .setAuthor({ name: `${user.username}`, iconURL: user.displayAvatarURL() })
                        .setTitle("PUGS Demotion")
                        .setDescription(`A poll is already ongoing for <@${user.id}> regarding demotion from <@&${roleToRemove.id}>.`)
                        .addFields({ name: 'Vouches', value: `\`\`\`${currentVotes}\`\`\`` })
                        .setFooter({ text: 'Click the button to vouch', iconURL: interaction.guild.iconURL() })
                        .setColor('#3640b7')
                        .setTimestamp();

                    return interaction.reply({
                        embeds: [pollEmbed],
                        components: [row],
                        ephemeral: true // Make sure the initiator gets an ephemeral response
                    });
                } else {
                    // No active poll, create a new one
                    const [pollInsert] = await pool.execute(
                        'INSERT INTO removal_polls (user_id, initiator_id, reason, status, poll_type) VALUES (?, ?, ?, "active", ?)',
                        [user.id, interaction.member.id, "Pending Reason", "pugs"] // Use "pugs" for PUGS polls
                    );

                    const pollId = pollInsert.insertId;

                    const vouchButton = new ButtonBuilder()
                        .setCustomId(`vouch_pugs_${pollId}`)
                        .setLabel('Vouch')
                        .setStyle(ButtonStyle.Primary);

                    const removeButton = new ButtonBuilder()
                        .setCustomId(`remove_pugs_${pollId}`)
                        .setLabel('Remove')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true); // Initially disabled

                    const row = new ActionRowBuilder().addComponents(vouchButton, removeButton);

                    // Initial embed for command initiator
                    const initialEmbed = new EmbedBuilder()
                        .setDescription(`Vouches Required\n> In order to remove <@${user.id}> from <@&${roleToRemove.id}>, you need at least \`6\` vouches.`)
                        .setFooter({ text: 'Click the button to vouch', iconURL: interaction.guild.iconURL() })
                        .setColor('#3640b7')
                        .setTimestamp();

                    await interaction.reply({
                        embeds: [initialEmbed],
                        components: [row],
                        ephemeral: true
                    });

                    // Send message to #pugs-vouching channel
                    const pugsVouchingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pugs-vouching');
                    if (pugsVouchingChannel) {
                        const vouchingEmbed = new EmbedBuilder()
                            .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                            .setTitle("Vouch for Demotion")
                            .setDescription(`A poll has been created for <@${user.id}> regarding demotion from <@&${roleToRemove.id}>. Click the button to vouch.`)
                            .addFields({ name: 'Vouches', value: `\`\`\`0\`\`\`` })
                            .setFooter({ text: 'Click the button to vouch', iconURL: interaction.guild.iconURL() })
                            .setColor('#3640b7')
                            .setTimestamp();

                        const vouchMessage = await pugsVouchingChannel.send({
                            embeds: [vouchingEmbed],
                            components: [row]
                        });

                        // Store the message ID for later updates
                        await pool.execute('UPDATE removal_polls SET vouch_message_id = ? WHERE id = ?', [vouchMessage.id, pollId]);
                    }
                }

            } catch (error) {
                console.error('Error during the removal process:', error);
                return interaction.reply({ content: 'An error occurred while processing the removal.', ephemeral: true });
            }
        }
    }
});

// Handle the Vouch Button for PUGS
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('vouch_pugs_')) {
        const pollId = interaction.customId.split('_')[2];

        try {
            // Fetch poll details
            const [poll] = await pool.execute('SELECT status FROM removal_polls WHERE id = ?', [pollId]);

            // Check if the poll is already closed
            if (poll[0].status === 'closed') {
                return interaction.reply({
                    content: `This poll has already ended and cannot accept more vouches.`,
                    ephemeral: true
                });
            }

            // Allow anyone with the appropriate role to vouch
            const managerRole = interaction.guild.roles.cache.get(config.pugsManagerRoleId);
            if (!interaction.member.roles.cache.has(managerRole.id)) {
                return interaction.reply({
                    content: `You don't have permission to vouch for this removal.`,
                    ephemeral: true
                });
            }

            // Check if the user has already vouched for this poll
            const [existingVote] = await pool.execute(
                'SELECT * FROM removal_vouches WHERE poll_id = ? AND manager_id = ?',
                [pollId, interaction.member.id]
            );

            if (existingVote.length > 0) {
                return interaction.reply({
                    content: `You have already vouched for this removal.`,
                    ephemeral: true
                });
            }

            // Show the modal to collect the reason for demotion
            const modal = new ModalBuilder()
                .setCustomId(`vouch_reason_pugs_${pollId}`)
                .setTitle('Vouch for Demotion');

            const reasonInput = new TextInputBuilder()
                .setCustomId('reason_input')
                .setLabel('Reason for Demotion')
                .setStyle(TextInputStyle.Paragraph);

            const modalRow = new ActionRowBuilder().addComponents(reasonInput);
            modal.addComponents(modalRow);

            await interaction.showModal(modal);
        } catch (error) {
            console.error('Error during vouch process:', error);
            return interaction.reply({ content: 'An error occurred while processing the vouch.', ephemeral: true });
        }
    }
});

// Handle Modal Submission for Vouch for PUGS
client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId.startsWith('vouch_reason_pugs_')) {
        const pollId = parseInt(interaction.customId.split('_')[3], 10); // Adjusted index

        const reason = interaction.fields.getTextInputValue('reason_input');

        try {
            // Defer the reply to prevent timeout errors
            await interaction.deferReply({ ephemeral: true });

            // Insert vouch into the database with the parsed pollId
            await pool.execute(
                'INSERT INTO removal_vouches (poll_id, manager_id, reason) VALUES (?, ?, ?)',
                [pollId, interaction.member.id, reason]
            );

            // Update the reason for the poll if the vouch came from the poll initiator
            const [poll] = await pool.execute('SELECT initiator_id FROM removal_polls WHERE id = ?', [pollId]);
            const initiatorId = poll[0].initiator_id;

            if (interaction.member.id === initiatorId) {
                // Update the poll reason with the initiator's reason
                await pool.execute('UPDATE removal_polls SET reason = ? WHERE id = ?', [reason, pollId]);
            }

            // Get updated vote count
            const [votes] = await pool.execute('SELECT COUNT(*) as count FROM removal_vouches WHERE poll_id = ?', [pollId]);
            const currentVotes = votes[0].count;

            // Fetch poll details including userId and vouchMessageId
            const [pollDetails] = await pool.execute('SELECT * FROM removal_polls WHERE id = ?', [pollId]);
            const userId = pollDetails[0].user_id;
            const vouchMessageId = pollDetails[0].vouch_message_id;
            const pollReason = pollDetails[0].reason;

            // Fetch user and update the vouch message
            let user = interaction.guild.members.cache.get(userId);
            if (!user) {
                try {
                    user = await interaction.guild.members.fetch(userId);
                } catch (fetchError) {
                    return interaction.followUp({ content: `User not found or has left the server.`, ephemeral: true });
                }
            }

            // Determine which role to remove
            const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
            const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);
            const hasPugsRole = user.roles.cache.has(pugsRole.id);
            const hasPugsTrialRole = user.roles.cache.has(pugsTrialRole.id);
            const roleToRemove = hasPugsTrialRole ? pugsTrialRole : pugsRole;

            // Update the vouch message in #pugs-vouching
            const pugsVouchingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pugs-vouching');
            const vouchMessage = await pugsVouchingChannel.messages.fetch(vouchMessageId);

            // Update the vouch embed
            const updatedVouchEmbed = new EmbedBuilder()
                .setAuthor({ name: user.user.username, iconURL: user.user.displayAvatarURL() })
                .setTitle("PUGS Demotion")
                .setDescription(`A poll has been created for <@${userId}> regarding demotion from <@&${roleToRemove.id}>.`)
                .addFields({ name: 'Vouches', value: `\`\`\`${currentVotes}\`\`\`` })
                .setFooter({ text: 'Click the button to vouch', iconURL: interaction.guild.iconURL() })
                .setColor('#3640b7')
                .setTimestamp();

            await vouchMessage.edit({ embeds: [updatedVouchEmbed] });

            // Handle the final vote
            if (currentVotes >= 6) {
                // Demote the user by removing the role
                const member = interaction.guild.members.cache.get(userId);
                await closePreviousPoll(pollId);

                if (member && (hasPugsRole || hasPugsTrialRole)) {
                    await member.roles.remove(roleToRemove);

                    // Update the embed to indicate demotion and disable the vouch button
                    const finalVouchEmbed = new EmbedBuilder()
                        .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                        .setTitle("PUGS Removal")
                        .setDescription(`**<@${userId}> has been removed from <@&${roleToRemove.id}>.**`)
                        .addFields(
                            { name: 'Removed by', value: `<@${initiatorId}>`, inline: true },
                            { name: 'Reason', value: `> ${pollReason}`, inline: false }
                        )
                        .setFooter({ text: `${member.user.username} has been demoted`, iconURL: interaction.guild.members.cache.get(initiatorId).user.displayAvatarURL() })
                        .setColor('#e91e63')
                        .setTimestamp();

                    // Create undo and remove buttons
                    const undoButton = new ButtonBuilder()
                        .setCustomId(`undo_pugs_${pollId}`)
                        .setLabel('Undo')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(false);

                    const removeButton = new ButtonBuilder()
                        .setCustomId(`remove_pugs_${pollId}`)
                        .setLabel('Remove')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true);

                    const vouchButton = new ButtonBuilder()
                        .setCustomId(`vouch_pugs_${pollId}`)
                        .setLabel('Vouch')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true);

                    const row = new ActionRowBuilder().addComponents(vouchButton, removeButton, undoButton);

                    // Update the embed and components in #pugs-vouching
                    await vouchMessage.edit({ embeds: [finalVouchEmbed], components: [row] });

                    // Announce demotion in #pugs-voting
                    const votingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pugs-voting');
                    if (votingChannel) {
                        await votingChannel.send({ embeds: [finalVouchEmbed] });
                    }

                    return interaction.followUp({
                        content: `<@${userId}> has been demoted successfully.`,
                        ephemeral: true
                    });
                } else {
                    return interaction.followUp({ content: 'User no longer has the PUGS role or has left the server.', ephemeral: true });
                }
            } else {
                // Still need more vouches
                return interaction.followUp({
                    content: `Vouched successfully! You need \`${6 - currentVotes}\` more vouches.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error during vouch process:', error);
            return interaction.followUp({ content: 'An error occurred while processing the vouch.', ephemeral: true });
        }
    }
});

// Handle Undo Button for PUGS
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || !interaction.customId.startsWith('undo_pugs_')) return;

    const pollId = interaction.customId.split('_')[2];

    try {
        const [poll] = await pool.execute('SELECT * FROM removal_polls WHERE id = ?', [pollId]);
        const userId = poll[0].user_id;
        const initiatorId = poll[0].initiator_id;
        await closePreviousPoll(pollId);
        const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
        const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);
        const member = interaction.guild.members.cache.get(userId);

        // Decide which role to add back
        const roleToAdd = member.roles.cache.has(pugsTrialRole.id) ? pugsTrialRole : pugsRole;

        if (!member.roles.cache.has(pugsRole.id) && !member.roles.cache.has(pugsTrialRole.id)) {
            await member.roles.add(roleToAdd);

            // Update the embed to show that the user was added back
            const pugsVouchingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pugs-vouching');
            const vouchMessage = await pugsVouchingChannel.messages.fetch(poll[0].vouch_message_id);

            const updatedEmbed = new EmbedBuilder()
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setDescription(`Update: <@${userId}> has been added back to <@&${roleToAdd.id}>.`)
                .addFields({ name: 'Vouches', value: `\`\`\`3\`\`\`` })
                .setFooter({ text: `${interaction.user.username} has added ${member.user.username} back to PUGS`, iconURL: interaction.user.displayAvatarURL() })
                .setColor('#00FF00')
                .setTimestamp();

            const vouchButton = new ButtonBuilder()
                .setCustomId(`vouch_pugs_${pollId}`)
                .setLabel('Vouch')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true);

            const removeButton = new ButtonBuilder()
                .setCustomId(`remove_pugs_${pollId}`)
                .setLabel('Remove')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(false);

            const undoButton = new ButtonBuilder()
                .setCustomId(`undo_pugs_${pollId}`)
                .setLabel('Undo')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            const row = new ActionRowBuilder().addComponents(vouchButton, removeButton, undoButton);

            await vouchMessage.edit({ embeds: [updatedEmbed], components: [row] });

            return interaction.reply({
                content: `The user <@${userId}> has been restored to the role.`,
                ephemeral: true
            });
        } else {
            return interaction.reply({ content: `The user <@${userId}> already has the role.`, ephemeral: true });
        }
    } catch (error) {
        console.error('Error during undo process:', error);
        return interaction.reply({ content: 'An error occurred while processing the undo.', ephemeral: true });
    }
});

// Handle Remove Button After Undo for PUGS
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || !interaction.customId.startsWith('remove_pugs_')) return;

    const pollId = interaction.customId.split('_')[2];

    try {
        const [poll] = await pool.execute('SELECT * FROM removal_polls WHERE id = ?', [pollId]);
        const userId = poll[0].user_id;
        const initiatorId = poll[0].initiator_id;
        await closePreviousPoll(pollId);
        const pugsRole = interaction.guild.roles.cache.get(config.pugsRoleId);
        const pugsTrialRole = interaction.guild.roles.cache.get(config.pugsTrialRoleId);
        const member = interaction.guild.members.cache.get(userId);

        // Decide which role to remove
        const hasPugsRole = member.roles.cache.has(pugsRole.id);
        const hasPugsTrialRole = member.roles.cache.has(pugsTrialRole.id);
        const roleToRemove = hasPugsTrialRole ? pugsTrialRole : pugsRole;

        if (hasPugsRole || hasPugsTrialRole) {
            await member.roles.remove(roleToRemove);

            // Update the embed to show the final removal
            const pugsVouchingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pugs-vouching');
            const vouchMessage = await pugsVouchingChannel.messages.fetch(poll[0].vouch_message_id);

            const finalEmbed = new EmbedBuilder()
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setTitle("PUGS Demotion")
                .setDescription(`**<@${userId}> has been removed from <@&${roleToRemove.id}>.**`)
                .addFields(
                    { name: 'Vouches', value: `\`\`\`3\`\`\`` },
                    { name: 'Removed by', value: `<@${initiatorId}>`, inline: true }
                )
                .setFooter({ text: `${member.user.username} has been demoted`, iconURL: interaction.user.displayAvatarURL() })
                .setColor('#e91e63')
                .setTimestamp();

            const vouchButton = new ButtonBuilder()
                .setCustomId(`vouch_pugs_${pollId}`)
                .setLabel('Vouch')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true);

            const removeButton = new ButtonBuilder()
                .setCustomId(`remove_pugs_${pollId}`)
                .setLabel('Remove')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true);

            const row = new ActionRowBuilder().addComponents(vouchButton, removeButton);

            await vouchMessage.edit({ embeds: [finalEmbed], components: [row] });

            return interaction.reply({
                content: `<@${userId}> has been removed from the role.`,
                ephemeral: true
            });
        } else {
            return interaction.reply({ content: `The user <@${userId}> does not have the role.`, ephemeral: true });
        }
    } catch (error) {
        console.error('Error during final removal process:', error);
        return interaction.reply({ content: 'An error occurred while processing the final removal.', ephemeral: true });
    }
});
// premium add
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || interaction.commandName !== 'premium') return;
    
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'add') {

    const user = interaction.options.getUser('user');

    if (!user) {
        return interaction.reply({ content: 'User not found. Please provide a valid user.', ephemeral: true });
    }

    const member = interaction.guild.members.cache.get(user.id);
    if (!member) {
        return interaction.reply({ content: 'Member not found in this guild.', ephemeral: true });
    }

    const premiumRole = interaction.guild.roles.cache.get(config.premiumRoleId);
    if (!premiumRole) {
        return interaction.reply({ content: 'Premium role not found. Please check the configuration.', ephemeral: true });
    }

    const premiumManagerRole = interaction.guild.roles.cache.get(config.premiumManagerRoleId);
    if (!premiumManagerRole) {
        return interaction.reply({ content: 'Premium Manager role not found. Please check the configuration.', ephemeral: true });
    }

        if (!interaction.member.roles.cache.has(premiumManagerRole.id)) {
            return interaction.reply({ content: `Only <@&${config.premiumManagerRoleId}> can add the Premium role.`, ephemeral: true });
        }
        
        await member.roles.add(premiumRole);
        console.log(`Added Premium role to user ${user.id}`);

        const embed = new EmbedBuilder()
            .setDescription(`Added <@${user.id}> to <@&${config.premiumRoleId}>.`)
            .setColor('#c79504');

        await interaction.reply({ embeds: [embed], ephemeral: false });

        const announcementChannel = interaction.guild.channels.cache.find(ch => ch.name === 'premium-announcements');
        if (announcementChannel) {
            const announcementEmbed = new EmbedBuilder()
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setTitle("Premium Addition")
                .setDescription(`<@${user.id}> has been added to <@&${config.premiumRoleId}>`)
                .addFields({ name: 'Added by:', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#c79504');

            await announcementChannel.send({ embeds: [announcementEmbed] });
        } else {
            console.error('premium-announcements channel not found.');
        }
    }

    if (subcommand === 'remove') {
        const premiumManagerRole = interaction.guild.roles.cache.get(config.premiumManagerRoleId);

        if (!interaction.member.roles.cache.has(premiumManagerRole.id)) {
            return interaction.reply({ content: `> Only <@&${config.premiumManagerRoleId}> can remove the Premium role.`, ephemeral: true });
        }

        await member.roles.remove(premiumRole);
        console.log(`Removed Premium role from user ${user.id}`);

        const embed = new EmbedBuilder()
            .setDescription(`Removed <@${user.id}> from <@&${config.premiumRoleId}>.`)
            .setColor('#c79504');

        await interaction.reply({ embeds: [embed], ephemeral: false });

        const announcementChannel = interaction.guild.channels.cache.find(ch => ch.name === 'premium-announcements');
        if (announcementChannel) {
            const announcementEmbed = new EmbedBuilder()
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setTitle("Premium Removal")
                .setDescription(`<@${user.id}> has been removed from <@&${config.premiumRoleId}>`)
                .addFields({ name: 'Removed by:', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#c79504');

            await announcementChannel.send({ embeds: [announcementEmbed] });
        } else {
            console.error('premium-announcements channel not found.');
        }
    }
});
// premium list
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || interaction.commandName !== 'premium') return;

    const { commandName, options } = interaction;

    if (commandName === 'premium') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'list') {
            const premiumRole = interaction.guild.roles.cache.get(config.premiumRoleId);

            if (!premiumRole) {
                return interaction.reply({ content: 'Premium role not found in this server.', ephemeral: true });
            }

            const membersWithRole = await interaction.guild.members.fetch();
            const membersArray = membersWithRole
                .filter(member => member.roles.cache.has(premiumRole.id))
                .map(member => member);
            const pageSize = 10;
            const totalPages = Math.ceil(membersArray.length / pageSize);

            if (totalPages === 0) {
                const noMembersEmbed = new EmbedBuilder()
                    .setDescription('```ini\nNo members with Premium role found.\n```')
                    .setColor(0x980e00);
                return interaction.reply({ embeds: [noMembersEmbed], ephemeral: true });
            }

            let currentPage = 0; // Start with the first page
            const paginatedMembers = membersArray.slice(
                currentPage * pageSize,
                (currentPage + 1) * pageSize
            );

            const memberList = paginatedMembers
                .map(
                    (member, index) =>
                        `\`\`${index + 1 + currentPage * pageSize}.\`\` <@${member.id}>`
                )
                .join('\n');
            const userPosition =
                membersArray.findIndex(member => member.id === interaction.user.id) + 1;

            const listEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Premium List', iconURL: interaction.guild.iconURL() })
                .setDescription(
                    `Mode: **Premium** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`
                )
                .setFooter({
                    text: `${userPosition}. [${interaction.user.username}]`,
                    iconURL: interaction.user.displayAvatarURL(),
                })
                .setColor('#c79504');

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev_premium_${interaction.user.id}_${currentPage}`)
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`next_premium_${interaction.user.id}_${currentPage}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1)
            );

            await interaction.reply({
                embeds: [listEmbed],
                components: [buttons],
                ephemeral: false,
            });
        }
    }
});
// Button interaction handler for 'premium' list
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    if (customId.startsWith('prev_premium_') || customId.startsWith('next_premium_')) {
        const [action, , userId, currentPageStr] = customId.split('_');

        if (userId !== interaction.user.id) {
            return interaction.reply({
                content: 'Only the user who initiated this command can interact with these buttons.',
                ephemeral: true,
            });
        }

        let currentPage = parseInt(currentPageStr);
        const premiumRole = interaction.guild.roles.cache.get(config.premiumRoleId);

        if (!premiumRole) {
            return interaction.update({
                content: 'Premium role not found.',
                components: [],
                embeds: [],
            });
        }

        const membersWithRole = await interaction.guild.members.fetch();
        const membersArray = membersWithRole
            .filter(member => member.roles.cache.has(premiumRole.id))
            .map(member => member);
        const pageSize = 10;
        const totalPages = Math.ceil(membersArray.length / pageSize);

        if (action === 'next') {
            currentPage += 1;
        } else if (action === 'prev') {
            currentPage -= 1;
        }

        if (currentPage < 0 || currentPage >= totalPages) {
            return interaction.deferUpdate(); // Ignore invalid page numbers
        }

        const paginatedMembers = membersArray.slice(
            currentPage * pageSize,
            (currentPage + 1) * pageSize
        );
        const memberList = paginatedMembers
            .map(
                (member, index) =>
                    `\`\`${index + 1 + currentPage * pageSize}.\`\` <@${member.id}>`
            )
            .join('\n');
        const userPosition =
            membersArray.findIndex(member => member.id === interaction.user.id) + 1;

        const listEmbed = new EmbedBuilder()
            .setAuthor({ name: 'Premium Members List', iconURL: interaction.guild.iconURL() })
            .setDescription(
                `Mode: **Premium** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`
            )
            .setFooter({
                text: `${userPosition}. [${interaction.user.username}]`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setColor('#e96d6d');

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`prev_premium_${interaction.user.id}_${currentPage}`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`next_premium_${interaction.user.id}_${currentPage}`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages - 1)
        );

        await interaction.update({ embeds: [listEmbed], components: [buttons] });
    }
});



// join and leave messagse
const registerChannelId = '1228653982134833203';
const entranceChannelId = '1298246407752515627';  // Entrance channel ID
const exitChannelId = '1298246423665442928';     // Exit channel ID

client.on('guildMemberAdd', async member => {
    // Welcome message in the entrance channel
    const entranceChannel = member.guild.channels.cache.get(entranceChannelId);
    if (entranceChannel) {
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#90EE90')  // Dark green color
            .setDescription(`# > ${member.user.username}\n> Enjoy your stay!`)
            .setFooter({
                text: `We now have ${member.guild.memberCount} members!`,
                iconURL: member.guild.iconURL(),
            })
            .setThumbnail(member.user.displayAvatarURL());

        entranceChannel.send({
            content: `<@${member.user.id}>, Welcome to Pika Ranked Bedwars!`,
            embeds: [welcomeEmbed],
        });
    }

    // Ghost ping in the register channel
    const registerChannel = member.guild.channels.cache.get(registerChannelId);
    if (registerChannel) {
        try {
            // Send a ping message to the new member
            const ghostPingMessage = await registerChannel.send(`<@${member.user.id}>`);

            // Delete the message after a short delay to ensure the notification is sent
            setTimeout(() => {
                ghostPingMessage.delete().catch(err => console.error('Failed to delete ghost ping message:', err));
            }, 1000); // Delete after 1 second
        } catch (error) {
            console.error('Error ghost pinging the member:', error);
        }
    }
});

client.on('guildMemberRemove', member => {
    const exitChannel = member.guild.channels.cache.get(exitChannelId);
    if (!exitChannel) return;

    const leaveEmbed = new EmbedBuilder()
        .setColor('#8B0000')  // Light red color
        .setDescription(`# > ${member.user.username}\n> See you soon!`)
        .setFooter({
            text: `We now have ${member.guild.memberCount} members!`,
            iconURL: member.guild.iconURL(),
        })
        .setThumbnail(member.user.displayAvatarURL());

    exitChannel.send({
        content: `<@${member.user.id}> just left the server.`,
        embeds: [leaveEmbed],
    });
});




const forbiddenTranslationChannels = [
    '1228653982134833205', '1228653982134833206', 
    '1228653982134833207', '1238583192047325234', 
    '1252599901133602866', '1228653983065837579', 
    '1228653983065837580', '1228653982134833208',
    '1236565092896735313', '1228653982637887570',
    '1228653982637887571', '1228653982637887572',
    '1228653982637887573', '1228653982637887575',
    '1228653982637887574', '1228653982637887576',
    '1228653982637887577', '1244653597421998142',
    '1262866702614659073', '1263642069566623745',
    '1288377115124830281', '1228653983912955947',
    '1228653983912955946', '1228653983912955948',
    '1228653983464427582', '1297637181728227389',
    '1259786959614640168', '1298241402307743794',
    '1298237605170774016'
];
// Translation channel ID where the blacklist messages will be sent
const translationChannelId = '1298246790092685403'; // Replace with the actual translator channel ID

// Function to check if a user is blacklisted
async function isUserBlacklisted(userId) {
    const query = `SELECT * FROM translation_blacklist WHERE user_id = ? LIMIT 1`;
    const [rows] = await pool.execute(query, [userId]);
    return rows.length > 0;
}

// Function to add user to blacklist
async function blacklistUser(userId, messageId, channelId, reason, issuedBy, customDuration = false) {
    const query = `
        INSERT INTO translation_blacklist (user_id, message_id, channel_id, blacklist_reason, issued_by, custom_duration)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    await pool.execute(query, [userId, messageId, channelId, reason, issuedBy, customDuration]);
    console.log(`User ${userId} has been blacklisted.`);
}

async function getChannelReactionCount(userId, channelId) {
    const query = `
        SELECT COUNT(DISTINCT message_id) AS reaction_count FROM translation_reactions
        WHERE user_id = ? AND channel_id = ? AND reaction_timestamp >= (NOW() - INTERVAL 60 SECOND)
    `;
    const [rows] = await pool.execute(query, [userId, channelId]);
    return rows.length > 0 ? rows[0].reaction_count : 0;
}



// Function to track reaction count for the user per message and per channel
async function trackReaction(userId, messageId, channelId) {
    const query = `
        INSERT IGNORE INTO translation_reactions (user_id, message_id, channel_id, reaction_timestamp)
        VALUES (?, ?, ?, NOW())
    `;
    await pool.execute(query, [userId, messageId, channelId]);
}


async function hasUserReacted(userId, messageId, channelId) {
    const query = `
        SELECT 1 FROM translation_reactions
        WHERE user_id = ? AND message_id = ? AND channel_id = ?
        LIMIT 1
    `;
    const [rows] = await pool.execute(query, [userId, messageId, channelId]);
    return rows.length > 0;
}




// Function to send a blacklist notification to the translator channel and store message ID
async function sendBlacklistNotification(user, message, reason) {
    const translatorChannel = client.channels.cache.get(translationChannelId);

    const blacklistEmbed = new EmbedBuilder()
        .setColor('#974300')
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL({ dynamic: true }) })
        .setTitle('Translation Blacklist <:ban:1298248109201035264> ')
        .setDescription(`**User:** <@${user.id}>\n**Issued by:** System\n**Reason:**\n> ${reason}`)
        .setThumbnail(message.guild.iconURL({ dynamic: true }))
        .setFooter({ text: 'Click the button to unblacklist', iconURL: message.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

    const unblacklistButton = new ButtonBuilder()
        .setCustomId(`unblacklist_${user.id}`)
        .setLabel('Remove Blacklist')
        .setEmoji('⚖️')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(unblacklistButton);

    // Send the embed and store the message reference
    const sentMessage = await translatorChannel.send({ embeds: [blacklistEmbed], components: [row] });

    // Store the notification message ID in the database with the blacklist info
    const storeMessageIdQuery = `
        UPDATE translation_blacklist
        SET notification_message_id = ?
        WHERE user_id = ?
    `;
    await pool.execute(storeMessageIdQuery, [sentMessage.id, user.id]);

    console.log(`Blacklist notification for user ${user.id} sent and stored with message ID ${sentMessage.id}`);
}

async function unblacklistUser(userId) {
    const deleteBlacklistQuery = `DELETE FROM translation_blacklist WHERE user_id = ?`;

    // Remove the user from the blacklist
    await pool.execute(deleteBlacklistQuery, [userId]);
    console.log(`User ${userId} has been unblacklisted.`);

    // Reaction counts are preserved
    console.log(`Reaction counts for user ${userId} are preserved.`);
}







// Main event listener for message reactions
client.on('messageReactionAdd', async (reaction, user) => {
    console.log('Reaction added');

    // Fetch full reaction if partial
    if (reaction.partial) {
        try {
            await reaction.fetch();
            console.log('Partial reaction fetched successfully');
        } catch (error) {
            console.error('Error fetching partial reaction:', error);
            return;
        }
    }

    console.log(`Reaction added by ${user.tag} with emoji ${reaction.emoji.name}`);

    // Check for forbidden channels
    if (forbiddenTranslationChannels.includes(reaction.message.channel.id)) {
        console.log('Reaction is in a forbidden channel.');
        return;
    }

    // Handle translation reaction
    if (reaction.emoji.id === '1298248723394068541' && !user.bot) {
        console.log('Translation reaction detected.');

        const message = reaction.message;
        const originalText = message.content;

        if (!originalText) {
            console.log('No message content to translate.');
            return;
        }

        if (await isUserBlacklisted(user.id)) {
            console.log(`User ${user.tag} is blacklisted.`);
            return;
        }

        // Check if the user has already reacted to this message
        if (await hasUserReacted(user.id, message.id, message.channel.id)) {
            console.log(`User ${user.tag} has already reacted to this message. Ignoring.`);
            return;
        }

        // Track the reaction
        await trackReaction(user.id, message.id, message.channel.id);

        // Get the number of unique messages the user has reacted to in this channel
        const channelReactionCount = await getChannelReactionCount(user.id, message.channel.id);
        console.log(`User ${user.tag} has reacted to ${channelReactionCount} unique messages in this channel.`);

        // Blacklist if reactions reach threshold
        if (channelReactionCount >= 4) {
            await blacklistUser(user.id, message.id, message.channel.id, 'Spamming translation emoji across different messages in the same channel within a short period', message.author.id, false);
            await sendBlacklistNotification(user, message, 'Spamming translation emoji across different messages in the same channel within a short period');
            console.log(`User ${user.tag} has been blacklisted for spamming translation reactions across multiple messages in the same channel.`);
            return;
        }        

        // Translation logic (only if the user is not blacklisted)
        try {
            console.log(`Original text: ${originalText}`);

            // Scrape Google Translate
            const url = `https://translate.google.com/m?hl=en&sl=auto&tl=en&ie=UTF-8&prev=_m&q=${encodeURIComponent(originalText)}`;
            const response = await axios.get(url);
            const dom = new JSDOM(response.data);

            // Extract translated text
            const translatedText = dom.window.document.querySelector('.result-container').textContent;

            // If translation failed
            if (!translatedText) {
                console.error('Failed to extract translation from the response.');
                await message.reply({ content: 'Failed to translate the message.', allowedMentions: { repliedUser: false } });
                return;
            }

            console.log(`Translated text: ${translatedText}`);

            const fromLang = 'auto';  // Auto-detect the source language (you can customize this)

            // Create an embed for the translated message
            const embed = new EmbedBuilder()
                .setColor('#1a37db')
                .setAuthor({
                    name: message.author.username,
                    iconURL: message.author.displayAvatarURL({ dynamic: true })
                })
                .setDescription(`- **Original Text**\n> ${originalText}\n- **Translated**\n> ${translatedText}`)
                .setFooter({ text: `Translated from ${languageMap[fromLang] || fromLang} to English` })
                .setTimestamp();

            // Reply to the message with the translation and ping the user
            await message.reply({
                content: `<@${user.id}>`, // Ping User 2 (who reacted)
                embeds: [embed],
                allowedMentions: { users: [user.id], repliedUser: false }  // Only allow mentions for User 2
            });    
        } catch (error) {
            console.error(error);
            await message.reply({ content: 'An error occurred while trying to translate the message.', allowedMentions: { repliedUser: false } });
        }
    } else {
        console.log('Reaction emoji does not match or reaction is from a bot.');
    }
});



client.on('interactionCreate', async (interaction) => {
    // Check if the interaction is a button
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Check if the button is an "unblacklist" button
    if (customId.startsWith('unblacklist_')) {
        const userId = customId.split('_')[1]; // Extract the user ID from the button's custom ID

        try {
            // Check if the user is blacklisted
            const userIsBlacklisted = await isUserBlacklisted(userId); // Assume `isUserBlacklisted` function is defined

            if (userIsBlacklisted) {
                // Unblacklist the user and reset their translation counts
                await unblacklistUser(userId);
                console.log(`User ${userId} has been unblacklisted successfully.`);
            } else {
                console.log(`User ${userId} is no longer in the blacklist.`);
                // Continue with UI updates even if the user was already removed
            }

            // Get the original embed message that triggered the button
            const originalMessage = interaction.message;

            // Clone the existing embed and modify it
            const embed = originalMessage.embeds[0]; // Get the first embed from the original message

            const updatedEmbed = EmbedBuilder.from(embed)  // Clone the existing embed
                .setColor('#228B22')                      // Change color to dark green (hex code for dark green)
                .setFooter({ text: `User has been Unblacklisted` }); // Update the footer

            // Disable the unblacklist button
            const disabledButton = ButtonBuilder.from(interaction.component)
                .setDisabled(true);  // Disable the button

            const row = new ActionRowBuilder().addComponents(disabledButton);

            // Edit the original message to update the embed and disable the button
            await interaction.update({ embeds: [updatedEmbed], components: [row] });

            // Notify the moderator that the user has been unblacklisted and counts reset
            await interaction.followUp({ content: `<@${userId}> has been unblacklisted and their translation counts have been reset.`, ephemeral: true });

        } catch (error) {
            console.error('Failed to unblacklist the user:', error);
            await interaction.reply({ content: 'There was an error unblacklisting the user.', ephemeral: true });
        }
    }
});


async function resetReactionCounts() {
    const query = `DELETE FROM translation_reactions`;

    try {
        await pool.execute(query);
    } catch (error) {
        console.error('Error resetting translation reaction counts:', error);
    }
}

// Function to automatically reset blacklists if duration is not custom and 60 seconds have passed
async function resetBlacklists() {
    const query = `
        SELECT user_id, notification_message_id FROM translation_blacklist 
        WHERE custom_duration = FALSE 
        AND blacklist_timestamp <= (NOW() - INTERVAL 60 SECOND)
    `;

    try {
        const [blacklistedUsers] = await pool.execute(query);

        for (const { user_id, notification_message_id } of blacklistedUsers) {
            // Unblacklist the user and reset their counts
            await unblacklistUser(user_id);

            // Fetch the notification message from the translator channel to update the embed
            const channel = client.channels.cache.get(translationChannelId);
            if (channel && notification_message_id) {
                try {
                    const notificationMessage = await channel.messages.fetch(notification_message_id);

                    if (notificationMessage) {
                        // Edit the embed and disable the button
                        const embed = notificationMessage.embeds[0];

                        const updatedEmbed = EmbedBuilder.from(embed)
                            .setColor('#228B22')  // Change color to dark green
                            .setFooter({ text: `User has been Unblacklisted` });

                        // Create the disabled button with "Cooldown Expired" and emoji ⌛
                        const expiredButton = new ButtonBuilder()
                            .setCustomId(`unblacklist_${user_id}`)
                            .setLabel('Cooldown Expired')
                            .setEmoji('⌛')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true);

                        const row = new ActionRowBuilder().addComponents(expiredButton);

                        await notificationMessage.edit({ embeds: [updatedEmbed], components: [row] });
                        console.log(`Embed for user ${user_id} has been updated with cooldown expired button.`);
                    }
                } catch (err) {
                    if (err.code === 10008) { // Unknown Message
                        console.warn(`Notification message for user ${user_id} does not exist. Removing message ID from database.`);
                        // Remove the invalid notification_message_id from the database
                        const removeMessageIdQuery = `
                            UPDATE translation_blacklist
                            SET notification_message_id = NULL
                            WHERE user_id = ?
                        `;
                        await pool.execute(removeMessageIdQuery, [user_id]);
                    } else {
                        console.error(`Failed to fetch or edit notification message for user ${user_id}:`, err);
                    }
                    // Continue to next user
                }
            } else {
                console.warn(`Channel or notification_message_id is invalid for user ${user_id}.`);
            }
        }
    } catch (error) {
        console.error('Error resetting blacklists:', error);
    }
}



setInterval(async () => {
    await resetReactionCounts();
    await resetBlacklists();
}, 60*1000);

const languageMap = {
    en: 'English',
    id: 'Indonesian',
    ko: 'Korean',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    // Add more languages as needed
};
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'translation_blacklist') {
        const user = options.getUser('user');
        const duration = options.getString('duration');
        const reason = options.getString('reason') || 'No reason provided';

        // Convert duration to milliseconds
        const durationMs = ms(duration); // You can use the `ms` package for duration parsing

        // Blacklist the user (assuming the blacklistUser function is defined)
        await blacklistUser(user.id, 'manual', 'manual', reason, interaction.user.id, durationMs);

        // Respond to the command issuer
        await interaction.reply({ content: `${user.tag} has been blacklisted for ${duration}.`, ephemeral: true });

        // Schedule the unblacklist
        setTimeout(async () => {
            await unblacklistUser(user.id); // Assuming unblacklistUser function exists
        }, durationMs);
    }

    if (commandName === 'translation_unblacklist') {
        const user = options.getUser('user');

        // Unblacklist the user manually
        await unblacklistUser(user.id);

        // Respond to the command issuer
        await interaction.reply({ content: `${user.tag} has been unblacklisted.`, ephemeral: true });
    }
});



client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'upgrade') {
            await handlePromoteCommand(interaction);
        }
    } else if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'upgrade') {
            await handlePromoteAutocomplete(interaction);
        }
    }
});
async function handlePromoteCommand(interaction) {
    const user = interaction.options.getUser('user');
    const tier = interaction.options.getString('tier');

    const guild = interaction.guild;
    const member = interaction.member; // The user who invoked the command
    const targetMember = await guild.members.fetch(user.id);

    // Use your existing configuration

    // Check if the command user has manager roles
    const hasPupsManagerRole = member.roles.cache.has(config.pupsManagerRoleId);
    const hasPugsManagerRole = member.roles.cache.has(config.pugsManagerRoleId);
    const hasPremiumManagerRole = member.roles.cache.has(config.premiumManagerRoleId);

    // Check if the user has any of the manager roles
    if (!hasPupsManagerRole && !hasPugsManagerRole && !hasPremiumManagerRole) {
        // User does not have permission
        const embed = new EmbedBuilder()
            .setDescription(`Only people with the following roles can use this command:\n- <@&${config.pupsManagerRoleId}>\n- <@&${config.pugsManagerRoleId}>\n- <@&${config.premiumManagerRoleId}>`)
            .setColor('#e74c3c');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Handle promotion based on the tier
    switch (tier) {
        case 'pups':
            if (hasPupsManagerRole || hasPugsManagerRole || hasPremiumManagerRole) {
                await promoteToPups(interaction, targetMember);
            } else {
                await denyPermission(interaction);
            }
            break;
        case 'pugs_trial':
            if (hasPugsManagerRole || hasPremiumManagerRole) {
                await promoteToPugsTrial(interaction, targetMember);
            } else {
                await denyPermission(interaction);
            }
            break;
        case 'pugs':
            if (hasPugsManagerRole || hasPremiumManagerRole) {
                await promoteToPugs(interaction, targetMember);
            } else {
                await denyPermission(interaction);
            }
            break;
        case 'premium':
            if (hasPremiumManagerRole) {
                await promoteToPremium(interaction, targetMember);
            } else {
                await denyPermission(interaction);
            }
            break;
        default:
            // Invalid tier selected
            await interaction.reply({ content: 'Invalid tier selected.', ephemeral: true });
    }
}
async function handlePromoteAutocomplete(interaction) {
    const guild = interaction.guild;
    const member = interaction.member; // The user who invoked the command

    // Initialize options
    let options = [];

    // Check if the command user has any manager roles
    const hasPupsManagerRole = member.roles.cache.has(config.pupsManagerRoleId);
    const hasPugsManagerRole = member.roles.cache.has(config.pugsManagerRoleId);
    const hasPremiumManagerRole = member.roles.cache.has(config.premiumManagerRoleId);

    // Check if the command user has permission to promote
    if (!hasPupsManagerRole && !hasPugsManagerRole && !hasPremiumManagerRole) {
        options.push({ name: 'None', value: 'none' });
    } else {
        // Try to get the target user ID
        let targetUserId;

        // In an autocomplete interaction, options before the focused option are available
        const userOption = interaction.options.get('user');

        if (userOption && userOption.value) {
            targetUserId = userOption.value;
        } else {
            targetUserId = null;
        }

        if (!targetUserId) {
            // The user option hasn't been specified yet
            options.push({ name: 'Please select a user first.', value: 'none' });
        } else {
            // Fetch the target member using the user ID
            let targetMember;
            try {
                targetMember = await guild.members.fetch(targetUserId);
            } catch (error) {
                console.error('Error fetching target member:', error);
                options.push({ name: 'Error fetching user.', value: 'none' });
                await interaction.respond(
                    options.map(option => ({ name: option.name, value: option.value }))
                );
                return;
            }

            // Now proceed with your logic as before
            const targetRoles = targetMember.roles.cache;

            // Define role IDs for easier reference
            const pupsRoleId = config.pupsRoleId;
            const pugsTrialRoleId = config.pugsTrialRoleId;
            const pugsRoleId = config.pugsRoleId;
            const premiumRoleId = config.premiumRoleId;

            // Function to check if the target user has any of the specified roles
            const hasAnyRole = (roles) => roles.some(roleId => targetRoles.has(roleId));

            // Build options based on manager roles and target user's current roles
            if (hasPremiumManagerRole) {
                // Premium Manager can promote to any tier
                if (!targetRoles.has(premiumRoleId)) {
                    if (!targetRoles.has(pupsRoleId)) {
                        options.push({ name: 'PUPS', value: 'pups' });
                    }
                    if (!targetRoles.has(pugsTrialRoleId)) {
                        options.push({ name: 'PUGS Trial', value: 'pugs_trial' });
                    }
                    if (!targetRoles.has(pugsRoleId)) {
                        options.push({ name: 'PUGS', value: 'pugs' });
                    }
                    options.push({ name: 'Premium', value: 'premium' });
                } else {
                    options.push({ name: 'User is already at the highest tier.', value: 'none' });
                }
            } else if (hasPugsManagerRole) {
                // PUGS Manager
                if (targetRoles.has(pugsRoleId) || targetRoles.has(premiumRoleId)) {
                    options.push({ name: 'User is already PUGS or higher.', value: 'none' });
                } else if (targetRoles.has(pugsTrialRoleId)) {
                    options.push({ name: 'Promote to PUGS', value: 'pugs' });
                } else if (targetRoles.has(pupsRoleId)) {
                    options.push({ name: 'Promote to PUGS Trial', value: 'pugs_trial' });
                    options.push({ name: 'Promote to PUGS', value: 'pugs' });
                } else {
                    options.push({ name: 'PUPS', value: 'pups' });
                    options.push({ name: 'PUGS Trial', value: 'pugs_trial' });
                    options.push({ name: 'PUGS', value: 'pugs' });
                }
            } else if (hasPupsManagerRole) {
                // PUPS Manager
                if (hasAnyRole([pupsRoleId, pugsTrialRoleId, pugsRoleId, premiumRoleId])) {
                    options.push({ name: 'User is already PUPS or higher.', value: 'none' });
                } else {
                    options.push({ name: 'Promote to PUPS', value: 'pups' });
                }
            }
        }
    }

    // Respond to the autocomplete interaction
    await interaction.respond(
        options.map(option => ({ name: option.name, value: option.value }))
    );
}



async function denyPermission(interaction) {
    const embed = new EmbedBuilder()
        .setDescription(`You do not have permission to promote to this tier.\n> Only people with the appropriate roles can use this command.`)
        .setColor('#e74c3c');
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function promoteToPups(interaction, targetMember) {
    // Check if the target user already has PUPS or higher roles
    const targetRoles = targetMember.roles.cache;
    if (targetRoles.has(config.pupsRoleId) || targetRoles.has(config.pugsTrialRoleId) || targetRoles.has(config.pugsRoleId) || targetRoles.has(config.premiumRoleId)) {
        const embed = new EmbedBuilder()
            .setDescription(`<@${targetMember.id}> is already <@&${config.pupsRoleId}> or higher.`)
            .setColor('#e74c3c');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Add PUPS role to the target user
    try {
        await targetMember.roles.add(config.pupsRoleId);
        console.log(`Added PUPS role to ${targetMember.user.username}`);

        // Reply to the interaction
        const replyEmbed = new EmbedBuilder()
            .setDescription(`Added <@${targetMember.id}> to <@&${config.pupsRoleId}>.`)
            .setColor('#e91e63');

        await interaction.reply({ embeds: [replyEmbed], ephemeral: false });

        // Send announcement to pups-voting channel
        const votingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pups-voting');
        if (votingChannel) {
            const votingEmbed = new EmbedBuilder()
                .setAuthor({ name: targetMember.user.username, iconURL: targetMember.user.displayAvatarURL() })
                .setTitle('PUPS Addition')
                .setDescription(`<@${targetMember.id}> has been added to <@&${config.pupsRoleId}>`)
                .addFields({ name: 'Added by', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#e91e63');

            await votingChannel.send({ embeds: [votingEmbed] });
        } else {
            console.error('pups-voting channel not found.');
        }
    } catch (error) {
        console.error('Error adding PUPS role:', error);
        return interaction.reply({ content: 'Error adding PUPS role.', ephemeral: true });
    }
}

async function promoteToPugsTrial(interaction, targetMember) {
    // Check if the target user already has PUGS Trial or higher roles
    const targetRoles = targetMember.roles.cache;
    if (targetRoles.has(config.pugsTrialRoleId) || targetRoles.has(config.pugsRoleId) || targetRoles.has(config.premiumRoleId)) {
        const embed = new EmbedBuilder()
            .setDescription(`<@${targetMember.id}> is already <@&${config.pugsTrialRoleId}> or higher.`)
            .setColor('#e74c3c');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Add PUGS Trial role to the target user
    try {
        await targetMember.roles.add(config.pugsTrialRoleId);
        console.log(`Added PUGS Trial role to ${targetMember.user.username}`);

        // Reply to the interaction
        const replyEmbed = new EmbedBuilder()
            .setDescription(`Added <@${targetMember.id}> to <@&${config.pugsTrialRoleId}>.`)
            .setColor('#e74c3c');

        await interaction.reply({ embeds: [replyEmbed], ephemeral: false });

        // Send announcement to pugs-voting channel
        const votingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pugs-voting');
        if (votingChannel) {
            const votingEmbed = new EmbedBuilder()
                .setAuthor({ name: targetMember.user.username, iconURL: targetMember.user.displayAvatarURL() })
                .setTitle('PUGS Trial Addition')
                .setDescription(`<@${targetMember.id}> has been added to <@&${config.pugsTrialRoleId}>`)
                .addFields({ name: 'Added by', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#e74c3c');

            await votingChannel.send({ embeds: [votingEmbed] });
        } else {
            console.error('pugs-voting channel not found.');
        }
    } catch (error) {
        console.error('Error adding PUGS Trial role:', error);
        return interaction.reply({ content: 'Error adding PUGS Trial role.', ephemeral: true });
    }
}

async function promoteToPugs(interaction, targetMember) {
    // Check if the target user already has PUGS or higher roles
    const targetRoles = targetMember.roles.cache;
    if (targetRoles.has(config.pugsRoleId) || targetRoles.has(config.premiumRoleId)) {
        const embed = new EmbedBuilder()
            .setDescription(`<@${targetMember.id}> is already <@&${config.pugsRoleId}> or higher.`)
            .setColor('#b90d1a');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Remove PUGS Trial role if the user has it
    if (targetRoles.has(config.pugsTrialRoleId)) {
        await targetMember.roles.remove(config.pugsTrialRoleId);
    }

    // Add PUGS role to the target user
    try {
        await targetMember.roles.add(config.pugsRoleId);
        console.log(`Added PUGS role to ${targetMember.user.username}`);

        // Reply to the interaction
        const replyEmbed = new EmbedBuilder()
            .setDescription(`Added <@${targetMember.id}> to <@&${config.pugsRoleId}>.`)
            .setColor('#b90d1a');

        await interaction.reply({ embeds: [replyEmbed], ephemeral: false });

        // Send announcement to pugs-voting channel
        const votingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pugs-voting');
        if (votingChannel) {
            const votingEmbed = new EmbedBuilder()
                .setAuthor({ name: targetMember.user.username, iconURL: targetMember.user.displayAvatarURL() })
                .setTitle('PUGS Addition')
                .setDescription(`<@${targetMember.id}> has been added to <@&${config.pugsRoleId}>`)
                .addFields({ name: 'Added by', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#b90d1a');

            await votingChannel.send({ embeds: [votingEmbed] });
        } else {
            console.error('pugs-voting channel not found.');
        }
    } catch (error) {
        console.error('Error adding PUGS role:', error);
        return interaction.reply({ content: 'Error adding PUGS role.', ephemeral: true });
    }
}

async function promoteToPremium(interaction, targetMember) {
    // Check if the target user already has the Premium role
    const targetRoles = targetMember.roles.cache;
    if (targetRoles.has(config.premiumRoleId)) {
        const embed = new EmbedBuilder()
            .setDescription(`<@${targetMember.id}> is already <@&${config.premiumRoleId}>.`)
            .setColor('#c79504');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Add Premium role to the target user
    try {
        await targetMember.roles.add(config.premiumRoleId);
        console.log(`Added Premium role to ${targetMember.user.username}`);

        // Reply to the interaction
        const replyEmbed = new EmbedBuilder()
            .setDescription(`Added <@${targetMember.id}> to <@&${config.premiumRoleId}>.`)
            .setColor('#c79504');

        await interaction.reply({ embeds: [replyEmbed], ephemeral: false });

        // Send announcement to premium-announcements channel
        const announcementChannel = interaction.guild.channels.cache.find(ch => ch.name === 'premium-announcements');
        if (announcementChannel) {
            const announcementEmbed = new EmbedBuilder()
                .setAuthor({ name: targetMember.user.username, iconURL: targetMember.user.displayAvatarURL() })
                .setTitle('Premium Addition')
                .setDescription(`<@${targetMember.id}> has been added to <@&${config.premiumRoleId}>`)
                .addFields({ name: 'Added by', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#c79504');

            await announcementChannel.send({ embeds: [announcementEmbed] });
        } else {
            console.error('premium-announcements channel not found.');
        }
    } catch (error) {
        console.error('Error adding Premium role:', error);
        return interaction.reply({ content: 'Error adding Premium role.', ephemeral: true });
    }
}
