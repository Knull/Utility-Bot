

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`${client.user.tag} is ready!`);
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
            // Perform any startup logic here, e.g., setupTicketSystem, fetch guild info, etc.
    }
};
