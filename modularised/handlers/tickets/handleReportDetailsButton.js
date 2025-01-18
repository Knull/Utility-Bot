// handlers/tickets/handleReportDetailsButton.js
const { EmbedBuilder } = require('discord.js');
const { pool } = require('../../database');

module.exports = async function handleReportDetailsButton(interaction, client) {
    // Expected customId format: 'report_details_{ticketNumber}'
    const customId = interaction.customId;
    const ticketNumber = customId.split('_').pop();

    if (!ticketNumber) {
        return interaction.reply({ content: 'Invalid report details button.', ephemeral: true });
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
        console.error('Error handling report details button:', error);
        await interaction.reply({ content: 'Failed to retrieve report details.', ephemeral: true });
    }
};
