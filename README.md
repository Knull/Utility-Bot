# Pika Ranked Bedwars Bot

A modular Discord bot for managing the Ranked Bedwars community on the Pika Network. The bot uses [discord.js](https://discord.js.org/) and a MySQL database to provide commands and automation for staff and players.

## Project Structure
- `modularised/` – Node.js source code for the bot, including commands, events, and utilities.
- `modularised/config/` – configuration file where you must supply tokens, guild IDs, role IDs, and other required values.

## Prerequisites
- [Node.js](https://nodejs.org/) and npm
- Access to a MySQL database
- Discord bot token and guild information

## Installation
1. Clone this repository.
2. Install dependencies:
   ```bash
   cd modularised
   npm install
   ```
3. Configure the bot by editing `config/config.js` with the appropriate tokens, and IDs.
4. Add database connection details in `utilities/database.js`

## Database Setup
The repository does not provide automatic schema migrations. Create the required tables in your MySQL database manually using your own `CREATE TABLE` commands. You may keep these statements in a separate file (for example, `schema.sql`) and run them with:

```bash
mysql -u <user> -p PRBW < path/to/schema.sql
```

Replace `PRBW` with your database name if different.

## Usage
Start the bot from the `modularised` directory:
```bash
node index.js
```
## License
This project is released under the ISC license.