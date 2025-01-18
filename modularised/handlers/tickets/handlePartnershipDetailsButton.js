// handlers/tickets/handlePartnershipDetailsButton.js
const { EmbedBuilder } = require('discord.js');
const { pool } = require('../../database');

module.exports = async function handlePartnershipDetailsButton(interaction, client) {
    // Expected customId format: 'partnership_details_{ticketNumber}'
    const customId = interaction.customId;
    const ticketNumber = customId.split('_').pop();

    if (!ticketNumber) {
        return interaction.reply({ content: 'Invalid partnership details button.', ephemeral: true });
    }

    try {
        const channel = interaction.channel;
        const guild = interaction.guild;

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
        console.error('Error handling partnership details button:', error);
        await interaction.reply({ content: 'Failed to retrieve partnership details.', ephemeral: true });
    }
};
