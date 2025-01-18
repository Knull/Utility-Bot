// handlers/tickets/handleEvidenceButton.js
const { EmbedBuilder } = require('discord.js');
const { pool } = require('../../database');

module.exports = async function handleEvidenceButton(interaction, client) {
    // Expected customId format: 'evidence_{ticketNumber}'
    const customId = interaction.customId;
    const ticketNumber = customId.split('_').pop();

    if (!ticketNumber) {
        return interaction.reply({ content: 'Invalid evidence button.', ephemeral: true });
    }

    try {
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
    } catch (error) {
        console.error('Error handling evidence button:', error);
        await interaction.reply({ content: 'Failed to retrieve evidence.', ephemeral: true });
    }
};
