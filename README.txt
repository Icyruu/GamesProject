GUESS MY COUNTRY
=================

Requirements:
- Node.js 18+ recommended
- VS Code (optional)

Run:
1. Open this folder in VS Code.
2. Open a terminal in this folder.
3. Run: npm install
4. Run: npm start
5. On the host PC open: http://localhost:3000

LAN play:
- Find the host PC's local IPv4 address (Windows: ipconfig).
- Friends on the same Wi-Fi open:
  http://YOUR-PC-IP:3000
  Example: http://192.168.1.20:3000
- If Windows Firewall asks, allow Node.js on Private networks.

Online play:
- This code is network-ready, but for internet play you need to deploy the Node.js server to a public host.
- After deployment, everyone uses the deployed URL.
- Do not expose the server to the public internet without adding authentication/rate limiting for a production game.

Gameplay:
- Host creates a room.
- Players join with the 6-character room code.
- Everyone readies up.
- Each player types a real country as their secret country.
- During a turn, select a player and type ONE LETTER or the WHOLE COUNTRY.
- Correct letters are revealed.
- Wrong letters reveal nothing and the turn passes.
- Whole-country guesses immediately discover that country.
- Each turn lasts 15 seconds.
- Players receive points and finishing places.
- Shop items are stored only in the running server memory in this prototype.

Important:
- This is a prototype. Restarting server.js clears rooms and player customization.
- For a persistent production game, add a database/account system.


GITHUB + RENDER DEPLOYMENT
==========================

1. Create a PRIVATE GitHub repository.
2. Upload all files in this folder to that repository.
3. In Render, create a Web Service from the private GitHub repository.
4. Build command: npm install
5. Start command: npm start
6. Choose the Free plan for testing.
7. Render will provide the public game URL.

The server listens on the PORT supplied by Render and on 0.0.0.0.

IMPORTANT:
- Keep the GitHub repository PRIVATE.
- Do not put passwords, API keys, or other secrets in the repository.
- Client HTML/CSS/JavaScript is visible to browsers by nature; server.js remains server-side.
